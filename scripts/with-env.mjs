import { config } from 'dotenv';
import { spawnSync } from 'node:child_process';
const [envFile, script, ...args] = process.argv.slice(2);
if (!envFile || !script)
  throw new Error('Usage: node scripts/with-env.mjs .env.staging scripts/migrate.ts');
config({ path: envFile, override: true, quiet: true });
const result = spawnSync(process.execPath, ['--import', 'tsx', script, ...args], {
  env: process.env,
  stdio: 'inherit',
});
process.exitCode = result.status ?? 1;
