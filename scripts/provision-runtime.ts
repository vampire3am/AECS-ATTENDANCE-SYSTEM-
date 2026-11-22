import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
const connection = process.env.DATABASE_URL_UNPOOLED;
const envPath = process.argv[2] ?? '.env';
if (!connection) throw new Error('Direct owner connection required.');
const pool = new Pool({ connectionString: connection, max: 1 });
try {
  const role = 'aecs_runtime';
  const existing = await pool.query('select 1 from pg_roles where rolname=$1', [role]);
  if (existing.rowCount)
    throw new Error(
      'Runtime role already exists. Reuse its saved credentials; do not rotate automatically.',
    );
  const password = randomBytes(48).toString('base64url');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}'`);
    await client.query(`GRANT CONNECT ON DATABASE aecs_attend TO ${role}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await client.query(
      `GRANT SELECT,INSERT,UPDATE ON profiles,courses,batches,students,enrollments,batch_schedules,teacher_assignments,class_sessions,attendance_records,app_settings TO ${role}`,
    );
    await client.query(`GRANT SELECT,INSERT ON audit_logs TO ${role}`);
    await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON login_attempts TO ${role}`);
    await client.query(`GRANT USAGE ON SEQUENCE student_code_seq TO ${role}`);
    await client.query(`ALTER ROLE ${role} SET timezone='Asia/Kathmandu'`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  const url = new URL(connection);
  url.username = role;
  url.password = password;
  if (!url.hostname.includes('-pooler.'))
    url.hostname = url.hostname.replace('.ap-southeast-1', '-pooler.ap-southeast-1');
  url.searchParams.set('sslmode', 'verify-full');
  const env = await readFile(envPath, 'utf8');
  await writeFile(envPath, env.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${url.toString()}`));
  console.log('Created restricted runtime role; saved credentials without displaying them.');
} finally {
  await pool.end();
}
