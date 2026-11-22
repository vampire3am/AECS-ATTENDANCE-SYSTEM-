import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
const globalDb = globalThis as unknown as { aecsPool?: Pool };
export const pool =
  globalDb.aecsPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000,
    options: '-c timezone=Asia/Kathmandu',
  });
if (process.env.VERCEL) attachDatabasePool(pool);
if (process.env.NODE_ENV !== 'production') globalDb.aecsPool = pool;
export const db = drizzle(pool, { schema });
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
