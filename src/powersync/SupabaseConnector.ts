import {
  BaseObserver,
  UpdateType,
  type CommonPowerSyncDatabase,
  type CrudEntry,
  type PowerSyncBackendConnector,
} from "@powersync/web";

import {
  SupabaseClient,
  createClient,
  type PostgrestSingleResponse,
  type Session,
} from "@supabase/supabase-js";

export type SupabaseConfig = {
  supabaseUrl: string;
  supabaseKey: string;
  powersyncUrl: string;
};

/// Postgres Response codes that we cannot recover from by retrying.
const FATAL_RESPONSE_CODES = [
  // Class 22 — Data Exception
  // Examples include data type mismatch.
  new RegExp("^22...$"),
  // Class 23 — Integrity Constraint Violation.
  // Examples include NOT NULL, FOREIGN KEY and UNIQUE violations.
  new RegExp("^23...$"),
  // INSUFFICIENT PRIVILEGE - typically a row-level security violation
  new RegExp("^42501$"),
];

/**
 * Maximum rows per batched Supabase request. Bulk upserts are limited by
 * request body size; batched deletes put every id in the query string, so
 * keep this modest to stay clear of URL length limits.
 */
const UPLOAD_BATCH_SIZE = 500;

export type SupabaseConnectorListener = {
  initialized: () => void;
  sessionStarted: (session: Session) => void;
};

export class SupabaseConnector
  extends BaseObserver<SupabaseConnectorListener>
  implements PowerSyncBackendConnector {
  readonly client: SupabaseClient;
  readonly config: SupabaseConfig;

  currentSession: Session | null;

  constructor() {
    super();
    this.config = {
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      powersyncUrl: import.meta.env.VITE_POWERSYNC_URL,
      supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };

    this.client = createClient(
      this.config.supabaseUrl,
      this.config.supabaseKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );
    this.currentSession = null;
  }

  /**
   * We suggest you use the following function if you want to support login via username and password.
   * Note: this app is currently authenticating using an anonymous login.
   */
  // async login(username: string, password: string) {
  //   const {
  //     data: { session },
  //     error
  //   } = await this.client.auth.signInWithPassword({
  //     email: username,
  //     password: password
  //   });

  //   if (error) {
  //     throw error;
  //   }

  //   this.updateSession(session);
  // }

  async signInAnonymously() {
    const { data: { user } } = await this.client.auth.getUser();
    if (user?.id) return;

    const {
      data: { session },
      error
    } = await this.client.auth.signInAnonymously();

    if (error) {
      throw error;
    }

    this.updateSession(session);
  }

  async logout() {
    await this.client.auth.signOut();
    this.updateSession(null);
  }

  updateSession(session: Session | null) {
    this.currentSession = session;
    if (!session) {
      return;
    }
    this.iterateListeners((cb) => cb.sessionStarted?.(session));
  }

  async fetchCredentials() {
    const {
      data: { session },
      error
    } = await this.client.auth.getSession();

    if (!session || error) {
      throw new Error(`Could not fetch Supabase credentials: ${error}`);
    }

    console.debug('session expires at', session.expires_at);

    if (session == null) {
      throw new Error(`Failed to get Supabase session`);
    }

    return {
      endpoint: this.config.powersyncUrl,
      token: session.access_token,
    };
  }

  async uploadData(database: CommonPowerSyncDatabase): Promise<void> {
    // Fetch up to UPLOAD_BATCH_SIZE pending changes, which may span multiple
    // local transactions. PowerSync calls uploadData again while more changes
    // remain. Note: batches don't preserve transaction boundaries - if
    // transactional consistency with the backend is important, use
    // getNextCrudTransaction() and process each transaction in a single call.
    const crudBatch = await database.getCrudBatch(UPLOAD_BATCH_SIZE);

    if (!crudBatch) {
      return;
    }

    let lastGroup: CrudEntry[] = [];
    try {
      // Group consecutive operations of the same type on the same table, so
      // bulk inserts and deletes go to Supabase as a few batched requests
      // instead of one request per row. Only consecutive ops are grouped to
      // preserve the original operation order.
      let group: CrudEntry[] = [];
      for (const op of crudBatch.crud) {
        const prev = group[group.length - 1];
        if (prev && (prev.op !== op.op || prev.table !== op.table)) {
          lastGroup = group;
          await this.uploadBatch(group);
          group = [];
        }
        group.push(op);
      }
      if (group.length > 0) {
        lastGroup = group;
        await this.uploadBatch(group);
      }

      await crudBatch.complete();
    } catch (ex: unknown) {
      console.debug(ex);
      const error = ex as { code?: string };
      if (
        typeof error.code === "string" &&
        FATAL_RESPONSE_CODES.some((regex) => regex.test(error.code!))
      ) {
        /**
         * Instead of blocking the queue with these errors,
         * discard the (rest of the) transaction.
         *
         * Note that these errors typically indicate a bug in the application.
         * If protecting against data loss is important, save the failing records
         * elsewhere instead of discarding, and/or notify the user.
         */
        console.error(
          `Data upload error - discarding batch of ${lastGroup.length} ${lastGroup[0]?.op} ops on ${lastGroup[0]?.table}:`,
          ex
        );
        await crudBatch.complete();
      } else {
        // Error may be retryable - e.g. network error or temporary server error.
        // Throwing an error here causes this call to be retried after a delay.
        throw ex;
      }
    }
  }

  private async uploadBatch(batch: CrudEntry[]): Promise<void> {
    const { op, table } = batch[0];
    let result: PostgrestSingleResponse<null>;
    switch (op) {
      case UpdateType.PUT:
        result = await this.client
          .from(table)
          .upsert(batch.map((entry) => ({ ...entry.opData, id: entry.id })));
        break;
      case UpdateType.PATCH:
        // Partial updates may touch different columns per row, so they can't
        // share a single request; apply them one at a time.
        for (const entry of batch) {
          const patchResult = await this.client
            .from(table)
            .update(entry.opData)
            .eq("id", entry.id);
          this.throwOnError(patchResult);
        }
        return;
      case UpdateType.DELETE:
        result = await this.client
          .from(table)
          .delete()
          .in(
            "id",
            batch.map((entry) => entry.id)
          );
        break;
    }
    this.throwOnError(result);
  }

  private throwOnError(result: PostgrestSingleResponse<null>): void {
    if (result.error) {
      console.error(result.error);
      result.error.message = `Could not update Supabase. Received error: ${result.error.message}`;
      throw result.error;
    }
  }
}

export const connector = new SupabaseConnector();