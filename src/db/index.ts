import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

const dbPath = './data/app.db';

async function ensureDbDirectory() {
  const dir = dirname(dbPath);
  await mkdir(dir, { recursive: true });
}

let sqlite: Database.Database | null = null;

export async function getDb() {
  if (!sqlite) {
    await ensureDbDirectory();
    sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
  }
  return drizzle(sqlite, { schema });
}

export function getDbSync() {
  if (!sqlite) {
    throw new Error('Database not initialized. Call getDb() first.');
  }
  return drizzle(sqlite, { schema });
}

export { schema };
