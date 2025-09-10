-- See our guide for more information on how to set up your Supabase database: 
-- https://docs.powersync.com/integration-guides/supabase-+-powersync#supabase-powersync

CREATE TABLE counters
(
    id TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL
);

-- Create a role/user with replication privileges for PowerSync
CREATE ROLE powersync_role WITH REPLICATION BYPASSRLS LOGIN PASSWORD 'myhighlyrandompassword';
-- Set up permissions for the newly created role
-- Read-only (SELECT) access is required
GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync_role;

-- Create a publication to replicate tables.
-- Specify a subset of tables to replicate if required.
-- NOTE: this must be named "powersync" at the moment
CREATE PUBLICATION powersync FOR ALL TABLES;

-- Seed counters table with 100 rows
DO $$
DECLARE
  i INT;
  start_date TIMESTAMP := '2025-09-06 08:00:00'; -- day after your latest row
BEGIN
  FOR i IN 1..100 LOOP
    INSERT INTO counters (id, count, owner_id, created_at)
    VALUES (
      gen_random_uuid(),
      floor(random() * 200)::INT,        -- random count between 0–199
       gen_random_uuid(),                       -- replace with your desired owner_id
      start_date + (i - 1) * interval '1 day'
    );
  END LOOP;
END $$;
