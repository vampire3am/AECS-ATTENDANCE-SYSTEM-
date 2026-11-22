import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url || new URL(url).hostname.includes('-pooler'))
  throw new Error('A direct DATABASE_URL_UNPOOLED is required.');
const pool = new Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
  console.log('Migrations applied.');
} finally {
  await pool.end();
}
