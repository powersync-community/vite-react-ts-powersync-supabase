/**
 * Reproduces the OPFSWriteAheadVFS "disk I/O error" chain.
 *
 *   pnpm dev      # terminal 1
 *   pnpm repro    # terminal 2
 *
 * Four tabs share one OPFS database. While a large sync is downloading, the
 * script reloads one tab every few seconds and keeps writing to the database.
 * The writes fill the active WAL file, so the VFS keeps swapping files and
 * checkpointing. A tab that rejoins a moment late is then told about a
 * transaction whose WAL file has already been checkpointed and truncated away,
 * and it never recovers.
 *
 * Env: TABS=4  ROUNDS=30  HEADED=1  APP=http://localhost:5173
 */
import { chromium } from 'playwright';

const APP = process.env.APP ?? 'http://localhost:5173';
const TABS = Number(process.env.TABS ?? 4);
const ROUNDS = Number(process.env.ROUNDS ?? 30);
const HEADED = process.env.HEADED === '1';

const ROUND_MS = 4000; // seconds between reloads
const WRITE_MS = 400; // how often a tab writes
const WATCH_AFTER = 8; // rounds to keep watching once it breaks

// The chain, in the order it happens. The first is the defect itself; the rest
// are what the tab does afterwards, with its place in the WAL left wrong.
const FAILURES = [
  ['invalid WAL file', /invalid WAL file/],
  ['null transaction', /Cannot read properties of null \(reading 'id'\)/],
  ['disk I/O error', /disk I\/O error|SQLITE_IOERR/i],
  ['corrupt database', /database disk image is malformed/i]
];

// Writes into a localOnly table, so nothing is uploaded and no real data is
// touched. The traffic is the point, not the rows.
const WRITE_SQL = `
  WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 150)
  INSERT INTO churn(id, data) SELECT uuid(), hex(randomblob(256)) FROM seq`;
const TRIM_SQL = `DELETE FROM churn WHERE id IN (SELECT id FROM churn LIMIT 100)`;

const found = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await chromium.launch({ headless: HEADED });
// One context, so every tab is same-origin and shares the OPFS database.
const context = await browser.newContext();

console.log(`opening ${TABS} tabs on ${APP}`);
const tabs = [];
for (let i = 0; i < TABS; i++) {
  const page = await context.newPage();

  // Playwright forwards each database worker's console output to its page, so
  // these two events cover all three workers per tab.
  const check = (text) => {
    for (const [name, pattern] of FAILURES) {
      if (!pattern.test(text)) continue;
      found.set(name, (found.get(name) ?? 0) + 1);
      if (found.get(name) === 1) {
        console.log(`\n  >> tab ${i + 1}: ${name}\n     ${text.split('\n')[0].slice(0, 140)}\n`);
      }
    }
  };
  page.on('console', (message) => check(message.text()));
  page.on('pageerror', (error) => check(error.message));

  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  tabs.push(page);
}

const write = (page) =>
  page.evaluate(
    ([insert, trim]) => window.powerSync?.execute(insert).then(() => window.powerSync?.execute(trim)),
    [WRITE_SQL, TRIM_SQL]
  );

let tick = 0;
const writing = setInterval(() => void write(tabs[tick++ % TABS]).catch(() => {}), WRITE_MS);

let brokeAt = 0;
for (let round = 1; round <= ROUNDS; round++) {
  await sleep(ROUND_MS);

  // Reload one tab. The others keep syncing and writing, which is what keeps
  // the WAL rotating. Once a tab has broken, stop: reloading it would give it
  // a fresh WriteAhead instance and hide the damage.
  const tab = (round - 1) % TABS;
  if (!brokeAt) await tabs[tab].reload({ waitUntil: 'domcontentloaded' }).catch(() => {});

  // Read progress from a tab that was not just reloaded.
  const percent = await tabs[(tab + 1) % TABS]
    .evaluate(() => window.powerSync?.currentStatus?.downloadProgress?.downloadedFraction)
    .catch(() => null);

  const what = brokeAt ? 'watching the broken tab' : `reloaded tab ${tab + 1}`;
  console.log(`round ${round}: ${what}  downloaded=${percent == null ? '...' : `${Math.round(percent * 100)}%`}`);

  if (found.size && !brokeAt) brokeAt = round;
  if (brokeAt && round >= brokeAt + WATCH_AFTER) break;
}

clearInterval(writing);

if (found.size) {
  console.log(`\nREPRODUCED at round ${brokeAt}`);
  for (const [name, count] of found) console.log(`  ${name}: ${count}`);
  process.exitCode = 2;
} else {
  console.log('\nNot reproduced this run. It is a race, so run it again.');
}

await browser.close();
