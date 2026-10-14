const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const { migrate } = require('drizzle-orm/pglite/migrator');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const schema = require('@reka/database');

const migrationDirectory = resolve(__dirname, '../../../../packages/database/drizzle');
async function createPersistentPostgres({ migrationsFolder = migrationDirectory } = {}) {
  const dataRoot = mkdtempSync(join(tmpdir(), 'reka-inbox-postgres-'));
  const dataDirectory = join(dataRoot, 'data');
  let pg = new PGlite(dataDirectory);
  await pg.waitReady;

  let db = drizzle(pg, { schema });
  try {
    await migrate(db, { migrationsFolder });
  } catch (error) {
    await pg.close();
    rmSync(dataRoot, { recursive: true, force: true });
    throw error;
  }
  return {
    get db() { return db; },
    async migrate(migrationsFolder = migrationDirectory) {
      await migrate(db, { migrationsFolder });
    },
    async reopen() {
      await pg.close();
      pg = new PGlite(dataDirectory);
      await pg.waitReady;
      db = drizzle(pg, { schema });
      return db;
    },
    async close() {
      await pg.close();
      rmSync(dataRoot, { recursive: true, force: true });
    },
  };
}

module.exports = { createPersistentPostgres };
