# Vite + React + TS + PowerSync + Supabase

![App Demo](https://github.com/powersync-community/vite-react-ts-powersync-supabase/releases/download/v1.0.0/demo.gif)

A templated Vite, TS, React, PowerSync and Supabase project to get you started quickly with building offline-first applications with PowerSync and Supabase.

# Usage

## Install dependencies

```bash
npm install
```

## Local Development

###  Prerequisites
You will need the following tools installed on your local machine:
- [Docker](https://docs.docker.com/get-docker/)
- [Supabase CLI](supabase.com/docs/guides/local-development/cli/getting-started)

Follow the two steps below to run the entire PowerSync + Supabase stack locally using Docker without requiring any sign up.

1. Copy the environment template file:
   ```bash
   cp .env.local.template .env.local
   ```

2. Run the start-up commands for the various services:
   ```bash
   npm run dev:supabase
   npm run dev:powersync
   npm run dev:ui
   ```

Navigate to the local Vite URL e.g. http://localhost:5173/ Voilà!

## Cloud Development

To run the hosted versions of PowerSync + Supabase, follow the steps below.

### Prerequisites

| Tool/Service     | Version / Info             | Notes                                                  |
|------------------|----------------------------|--------------------------------------------------------|
| PowerSync        | Active account required    | [Sign up here](https://accounts.journeyapps.com/portal/powersync-signup)             |
| Supabase         | Active project/account     | [Sign up here](https://supabase.com/dashboard/sign-up)                   |

### Backend Setup
This section guides you through setting up the backend using Supabase and PowerSync. Follow the steps below to configure your backend environment.

#### 1. Setup Supabase
Follow these steps to set up your backend with Supabase and PowerSync (or you can follow the [guide](https://docs.powersync.com/integration-guides/supabase-+-powersync)).


1. [Create a new project on the Supabase dashboard](https://supabase.com/dashboard/projects).
2. Go to the Supabase SQL Editor for your new project and execute the SQL statements in [database.pgsql](database.pgsql) to create the database schema, database functions, and publication needed for PowerSync.
3. Enable "anonymous sign-ins" for the project [here](https://supabase.com/dashboard/project/_/auth/providers) (demo specific)

<details>
<summary><strong>Alternative: Setup using the Supabase CLI</strong></summary>

If you prefer using the Supabase CLI to develop the database locally and push it to a Supabase cloud later, you can set up your project as follows:
1. Login to your Supabase Account `npx supabase login`
2. Initialize your project `npx supabase init`
3. Enable "anonymous sign-ins" for the project [here](https://supabase.com/dashboard/project/_/auth/providers)
4. Copy your project ID from the Supabase dashboard [here](https://supabase.com/dashboard/project/_/settings/general)
5. Link your local project `npx supabase link --project-ref <project-id>`
6. Create your first migration with `npx supabase migration new create_powersync_tables` and then copy the contents of [database.pgsql](database.pgsql) into the newly created migration file in the `supabase/migrations` directory.
7. Push your tables to the cloud db
   ```shell
   npx supabase db push
   ```

</details>

#### 2. Setup PowerSync Instance and Connect to Supabase

1. In the [PowerSync dashboard](https://powersync.journeyapps.com/), create a new PowerSync instance:
   - Right-click on 'PowerSync Project' in the project tree on the left and click "Create new instance"
   - Pick a name for the instance e.g. "PowerSyncDemoInstance" and proceed.

2. In the "Edit Instance" dialog that follows, click on the "Connections" tab:
   - Click on the "+" button to create a new database connection.
   - Input the credentials from the project you created in Supabase. Go to [this page](https://supabase.com/dashboard/project/_?showConnect=true), copy & paste the connection string into the PowerSync dashboard "URI" field, and then enter your database password at the "Password" field. However, we do recommend using a dedicated database user for PowerSync, please refer to the [Source database guide](https://docs.powersync.com/installation/database-setup#2-create-a-powersync-database-user)
   - Click the "Test connection" button and you should see "Connection success!"

3. Click on the "Credentials" tab of the "Edit Instance" dialog:
   - Tick the "Use Supabase Auth" checkbox and configure the JWT secret.
   - Click "Save" to save all the changes to your PowerSync instance. The instance will now be deployed — this may take a minute or two.

<details>
<summary><strong>Alternative: Setup using the PowerSync CLI</strong></summary>

See [PowerSync CLI docs](https://docs.powersync.com/usage/tools/cli).

> This PowerSync CLI only works with **PowerSync Cloud instances.**
> The CLI currently does not support **self-hosted PowerSync instances.**

If you don't have a PowerSync account yet, [sign up here](https://accounts.journeyapps.com/portal/powersync-signup).

1. **Get your Personal Access Token:**
   - Go to the [PowerSync dashboard](https://powersync.journeyapps.com/)
   - Press `Ctrl + Shift + P` (or `Cmd + Shift + P` on Mac)
   - Search for "Create Personal Access Token"
   - Give it "owner" policy and a descriptive label
   - Copy the generated token
2. **Initialize the CLI and authenticate:**
   ```bash
   npx powersync init
   ```
Paste your Personal Access Token when prompted.
3. **Create a new PowerSync instance:**
   ```bash
   npx powersync instance create
   ```
Follow the prompts to configure:
- Instance name (e.g., "supabase-staging")
- Region (e.g., "EU")
- Database connection details from your Supabase project (use the **direct connection**, not pooling)
- When asked about Supabase auth, answer:
   - `? Are you using Supabase auth? Yes`
   - `? Do you want to add audiences? No`
4. **Deploy sync rules:**
   ```bash
   npx powersync instance sync-rules deploy -f sync-rules.yaml
   ```

> After deploying sync rules via CLI, the changes might not be reflected in the dashboard. If you want to see them in the dashboard, simply copy the contents of your `sync-rules.yaml` file and paste them into the dashboard's sync-rules editor, then redeploy.

</details>

#### 3. Deploy Sync Rules (not needed if using PowerSync CLI)

1. Open the [sync-rules.yaml](sync-rules.yaml) in this repo and copy the contents.
2. In the [PowerSync dashboard](https://powersync.journeyapps.com/), paste that into the 'sync-rules.yaml' editor panel.
3. Click the "Deploy sync rules" button and select your PowerSync instance from the drop-down list.

#### 4. Set environment variables

First, copy the environment template file:
```bash
cp .env.cloud.template .env.local
```

Then set the following environment variables in your `.env.local` file:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_POWERSYNC_URL=
```

**Where do you get these values?**

For Supabase, you can get both settings directly from:
- VITE_SUPABASE_URL - [API Settings & URL](https://supabase.com/dashboard/project/_/settings/api)
- VITE_SUPABASE_ANON_KEY - [API Keys](https://supabase.com/dashboard/project/_/settings/api-keys)

For PowerSync, follow these steps:
1. Go to your [PowerSync Dashboard](https://powersync.journeyapps.com/)
2. Navigate to your PowerSync instance
3. Copy the "Instance URL" for `VITE_POWERSYNC_URL`

## Use this project with bolt.new

**To run this repo using Bolt.new will only work with the [Cloud Development](#cloud-development) option.**

- Open this [link](https://bolt.new/github.com/powersync-community/vite-react-ts-powersync-supabase/tree/main) to load the project.
   - You will see a configuration error in the preview window because the `.env.local` file has not yet been defined.
- Create a new `.env.local` file and populate it with the appropriate Supabase and PowerSync credentials, as specified in the `.env.local.template` file included in this repository (refer to step 4 "Set up environment").
- Save the file — the app should launch automatically.
