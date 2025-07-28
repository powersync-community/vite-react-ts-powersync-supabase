# Vite + React + TS + PowerSync + Supabase

![App Demo](https://github.com/powersync-community/vite-react-ts-powersync-supabase/releases/download/v1.0.0/demo.gif)

A templated Vite, TS, React, PowerSync and Supabase project to get you started quickly with building offline-first applications with PowerSync and Supabase.

## Requirements

| Tool/Service     | Version / Info             | Notes                                                  |
|------------------|----------------------------|--------------------------------------------------------|
| Node.js (via nvm)| `v20.19.0`                 | Ensure you run `nvm use` to match the project version |
| PowerSync        | Active account required    | [Sign up here](https://accounts.journeyapps.com/portal/powersync-signup)             |
| Supabase         | Active project/account     | [Sign up here](https://supabase.com/dashboard/sign-up)                   |


# Getting Started

You have 4 options to get started with this template. We recommend using the first option for a quick start.

<details>
<summary><strong>1. Generate from template (Recommended)</strong></summary>

Generate a repository from this [template](https://github.com/powersync-community/vite-react-ts-powersync-supabase/generate).

</details>

<details>
<summary><strong>2. Use degit</strong></summary>

Use [degit](https://github.com/Rich-Harris/degit) to scaffold the project:

```bash
npx degit powersync-community/vite-react-ts-powersync-supabase
```

> **Note**: `degit` is a tool that downloads the latest version of a repository without the git history, giving you a clean starting point. Add a second argument to specify your project name (e.g., my-app).

</details>

<details>
<summary><strong>3. Clone the repository</strong></summary>

Clone the repository directly and install dependencies:

```bash
git clone https://github.com/powersync-community/vite-react-ts-powersync-supabase.git
```

</details>

<details>
<summary><strong>4. Start with bolt.new</strong></summary>

Start the project using [bolt.new](https://bolt.new):

- Open this [link](https://bolt.new/github.com/powersync-community/vite-react-ts-powersync-supabase/tree/main) to load the project.
  - You will see a configuration error in the preview window because the `.env.local` file has not yet been defined.
- Create a new `.env.local` file and populate it with the appropriate Supabase and PowerSync credentials, as specified in the `.env.local.template` file included in this repository (refer to step 4 "Set up environment").
- Save the file — the app should launch automatically.

</details>

## Usage

After cloning the repository, navigate to the project directory and install the dependencies:

```bash
cd vite-react-ts-powersync-supabase
npm install
npm run dev
```

---

# Backend Setup
This section guides you through setting up the backend using Supabase and PowerSync. Follow the steps below to configure your backend environment.

## 1. Setup Supabase
Follow these steps to set up your backend with Supabase and PowerSync (Or you can follow the [guide](https://docs.powersync.com/integration-guides/supabase-+-powersync)).

<details>
<summary><strong>Option 1: Setup using the Supabase Dashboard</strong></summary>

1. [Create a new project on the Supabase dashboard](https://supabase.com/dashboard/projects).
2. Go to the Supabase SQL Editor for your new project and execute the SQL statements in [database.pgsql](database.pgsql) to create the database schema, database functions, and publication needed for PowerSync.
3. Enable "anonymous sign-ins" for the project [here](https://supabase.com/dashboard/project/_/auth/providers) (demo specific)

</details>

<details>
<summary><strong>Option 2: Setup using the Supabase CLI</strong></summary>

If you prefer using the Supabase CLI, you can set up your project as follows:
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

## 2. Setup PowerSync Instance and Connect to Supabase

You can set up your PowerSync instance using either the Dashboard or CLI approach:

<details>
<summary><strong>Option 1: Setup using the PowerSync Dashboard</strong></summary>

If you prefer using the web interface:

1. In the [PowerSync dashboard](https://powersync.journeyapps.com/), create a new PowerSync instance:
   - Right-click on 'PowerSync Project' in the project tree on the left and click "Create new instance"
   - Pick a name for the instance e.g. "PowerSyncDemoInstance" and proceed.

2. In the "Edit Instance" dialog that follows, click on the "Connections" tab:
   - Click on the "+" button to create a new database connection.
   - Input the credentials from the project you created in Supabase. In the Supabase dashboard, under your project you can go to "Project Settings" and then "Database" and choose "URI" under "Connection string", **untick the "Use connection pooling" option** to use the direct connection, and then copy & paste the connection string into the PowerSync dashboard "URI" field, and then enter your database password at the "Password" field.
   - Click the "Test connection" button and you should see "Connection success!"

3. Click on the "Credentials" tab of the "Edit Instance" dialog:
   - Tick the "Use Supabase Auth" checkbox and configure the JWT secret.
   - Click "Save" to save all the changes to your PowerSync instance. The instance will now be deployed — this may take a minute or two.

</details>

<details>
<summary><strong>Option 2: Setup using the PowerSync CLI</strong></summary>

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

## 3. Deploy Sync Rules

<details>
<summary><strong>Option 1: Using CLI (if you used CLI setup above)</strong></summary>

The sync rules are already deployed if you followed the CLI setup steps above.

</details>

<details>
<summary><strong>Option 2: Using Dashboard</strong></summary>

1. Open the [sync-rules.yaml](sync-rules.yaml) in this repo and copy the contents.
2. In the [PowerSync dashboard](https://powersync.journeyapps.com/), paste that into the 'sync-rules.yaml' editor panel.
3. Click the "Deploy sync rules" button and select your PowerSync instance from the drop-down list.

</details>

## 4. Set up environment

First, copy the environment template file:
```bash
cp .env.local.template .env.local
```

Then set the following environment variables in your `.env.local` file:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_POWERSYNC_URL=
```

### How to get these values:

**VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY:**

**Quick Access:** For convenience, you can access both settings directly:
- [API Settings & URL](https://supabase.com/dashboard/project/_/settings/api)
- [API Keys](https://supabase.com/dashboard/project/_/settings/api-keys)

**Detailed Instructions:**
1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. For the URL: Navigate to Project Settings → Data API and copy the "Project URL" for `VITE_SUPABASE_URL`
4. For the key: Navigate to Project Settings → API Keys and copy the "anon public" key for `VITE_SUPABASE_ANON_KEY`

**VITE_POWERSYNC_URL:**
1. Go to your [PowerSync Dashboard](https://powersync.journeyapps.com/)
2. Select your project
3. Navigate to your PowerSync instance
4. Copy the "Instance URL" for `VITE_POWERSYNC_URL`