// Explicitly opt-in, disposable Neon branch ONLY. Never load .env or default to
// DATABASE_URL. Independent native PostgreSQL sessions prove locking behavior.
const { test } = require('node:test');
const { equal, ok, rejects } = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const databaseRequire = require('node:module').createRequire(resolve(__dirname, '../../../packages/database/package.json'));
const { Pool, neonConfig } = databaseRequire('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const { migrate } = require('drizzle-orm/neon-serverless/migrator');
const { WorkspaceService, secretHash } = require('../dist/workspace/workspace.service');
const schema = require('@reka/database');
const enabled = process.env.REKA_RUN_NATIVE_INTEGRATION === '1';
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const digest = rows => createHash('sha256').update(JSON.stringify(rows.map(row => JSON.stringify(row)).sort())).digest('hex');

async function waitBlocked(pool, pid) {
  for (let i = 0; i < 50; i++) {
    const { rows } = await pool.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [pid]);
    if (rows[0]?.wait_event_type === 'Lock') return;
    await delay(50);
  }
  throw new Error('Expected an overlapping native lock wait, not sequential execution');
}

test('disposable Neon branch: legacy integrity, separate-session owner races and atomic invitation races', { skip: !enabled, timeout: 180000 }, async () => {
  const connection = readFileSync(process.env.REKA_NATIVE_TEST_CONNECTION_FILE, 'utf8').trim();
  const host = new URL(connection).hostname;
  const metadata = JSON.parse(readFileSync(process.env.REKA_NATIVE_TEST_METADATA_FILE, 'utf8'));
  if (!metadata.branch?.parent_id || metadata.branch.default || metadata.branch.primary ||
    !metadata.branch.expires_at || !metadata.branch.name?.startsWith('reka-access-native') ||
    !metadata.endpoints?.some(endpoint => endpoint.host === host && endpoint.branch_id === metadata.branch.id)) {
    throw new Error('Expected metadata for an expiring non-primary disposable Neon child branch');
  }
  if (!process.env.REKA_NATIVE_TEST_HOST || host !== process.env.REKA_NATIVE_TEST_HOST || host.includes('-pooler')) {
    throw new Error('Expected explicitly selected direct disposable-branch hostname');
  }
  neonConfig.webSocketConstructor = global.WebSocket;
  const pool = new Pool({ connectionString: connection, max: 6 });
  const db = drizzle(pool, { schema });
  let c1, c2;
  try {
    const tables = (await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows;
    const before = [];
    for (const { table_name } of tables) {
      const columns = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", [table_name])).rows.map(row => row.column_name);
      const rows = (await pool.query(`SELECT ${columns.map(quote).join(',')} FROM public.${quote(table_name)}`)).rows;
      before.push({ table: table_name, columns, rows });
    }
    await migrate(db, { migrationsFolder: resolve(__dirname, '../../../packages/database/drizzle') });
    for (const saved of before) {
      const rows = (await pool.query(`SELECT ${saved.columns.map(quote).join(',')} FROM public.${quote(saved.table)}`)).rows;
      if (saved.table === 'organization_members') {
        // Foundation may enroll missing legacy accounts, but existing rows/roles remain.
        const after = new Set(rows.map(row => JSON.stringify(row)));
        for (const row of saved.rows) ok(after.has(JSON.stringify(row)), 'Existing membership preserved');
      } else equal(digest(rows), digest(saved.rows), `Existing ${saved.table} data preserved`);
    }
    console.log('Native copied-data migration integrity verified:', before.length, 'existing tables; no row contents/credentials logged');
    c1 = await pool.connect(); c2 = await pool.connect();
    const pid1 = (await c1.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const pid2 = (await c2.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    ok(pid1 !== pid2, 'Independent native backend sessions required');
    for (const isolation of ['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE']) {
      const org = randomUUID(), one = randomUUID(), two = randomUUID();
      await pool.query('INSERT INTO organizations(id,name,slug) VALUES($1,$2,$3)', [org, 'Native race fixture', `native-${org}`]);
      await pool.query('INSERT INTO users(id,name,email,role) VALUES($1,$2,$3,$4),($5,$6,$7,$8)', [one, 'Native one', `${one}@example.test`, 'owner', two, 'Native two', `${two}@example.test`, 'owner']);
      await pool.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner'),($1,$3,'owner')", [org, one, two]);
      await c1.query(`BEGIN ISOLATION LEVEL ${isolation}`); await c2.query(`BEGIN ISOLATION LEVEL ${isolation}`);
      await c1.query('SELECT count(*) FROM organization_members WHERE organization_id=$1', [org]);
      await c2.query('SELECT count(*) FROM organization_members WHERE organization_id=$1', [org]);
      await c1.query('UPDATE organization_members SET is_active=false WHERE organization_id=$1 AND user_id=$2', [org, one]);
      const second = c2.query('UPDATE organization_members SET is_active=false WHERE organization_id=$1 AND user_id=$2', [org, two]).then(() => ({ accepted: true }), error => ({ error }));
      await waitBlocked(pool, pid2);
      await c1.query('COMMIT');
      const result = await second;
      ok(!result.accepted, `${isolation}: concurrent last-owner removal rejected`);
      ok(['23514', '40001'].includes(result.error.code), `${isolation}: expected constraint/serialization rejection`);
      await c2.query('ROLLBACK');
      equal(Number((await pool.query("SELECT count(*) FROM organization_members WHERE organization_id=$1 AND role='owner' AND is_active", [org])).rows[0].count), 1);
      await rejects(pool.query('DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2', [org, two]));
      console.log('Verified native overlapping last-owner race:', isolation);
    }
    const org = randomUUID(), owner = randomUUID();
    await pool.query('INSERT INTO organizations(id,name,slug) VALUES($1,$2,$3)', [org, 'Native invite fixture', `native-${org}`]);
    await pool.query("INSERT INTO users(id,name,email,role) VALUES($1,'Native inviter',$2,'owner')", [owner, `${owner}@example.test`]);
    await pool.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner')", [org, owner]);
    const workspace = new WorkspaceService({ db });
    const email = `${randomUUID()}@example.test`;
    const invitation = await workspace.createInvitation(owner, { email, role: 'member' });
    const hash = secretHash(new URL(invitation.url).searchParams.get('invite'));
    await c1.query('BEGIN'); await c1.query('SELECT id FROM workspace_invitations WHERE token_hash=$1 FOR UPDATE', [hash]);
    const identity = { id: String(Date.now()), login: 'native-test-person', name: 'Native invited fixture', avatarUrl: null, verifiedEmails: [email] };
    const attempts = Promise.allSettled([workspace.acceptGithubInvitation(hash, identity), workspace.acceptGithubInvitation(hash, identity)]);
    let blocked = false;
    for (let i = 0; i < 50; i++) {
      const result = await pool.query("SELECT count(*) FROM pg_stat_activity WHERE pid<>$1 AND wait_event_type='Lock' AND query LIKE '%WITH pending AS MATERIALIZED%'", [pid1]);
      if (Number(result.rows[0].count) >= 2) { blocked = true; break; }
      await delay(50);
    }
    ok(blocked, 'Both invitation callbacks overlap behind the same row lock');
    await c1.query('COMMIT');
    const outcomes = await attempts;
    equal(outcomes.filter(value => value.status === 'fulfilled').length, 1);
    equal(outcomes.filter(value => value.status === 'rejected').length, 1);
    equal(Number((await pool.query('SELECT count(*) FROM users WHERE github_id=$1', [identity.id])).rows[0].count), 1);
    equal(Number((await pool.query('SELECT count(*) FROM sessions s JOIN users u ON u.id=s.user_id WHERE u.github_id=$1', [identity.id])).rows[0].count), 1);
    const accepted = await pool.query('SELECT accepted_at, accepted_by_id FROM workspace_invitations WHERE token_hash=$1', [hash]);
    ok(accepted.rows[0].accepted_at); ok(accepted.rows[0].accepted_by_id);
    const team = randomUUID(), lead = randomUUID(), handoff = randomUUID();
    await pool.query('INSERT INTO teams(id,organization_id,name,key,is_private) VALUES($1,$2,$3,$4,true)', [team, org, 'Private native team', `T${team.replaceAll('-', '').slice(0, 8)}`]);
    await pool.query("INSERT INTO users(id,name,email,role) VALUES($1,'Native team lead',$2,'member'),($3,'Native handoff lead',$4,'member')", [lead, `${lead}@example.test`, handoff, `${handoff}@example.test`]);
    await pool.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'member'),($1,$3,'member')", [org, lead, handoff]);
    await pool.query("INSERT INTO team_members(team_id,user_id,role) VALUES($1,$2,'lead'),($1,$3,'lead')", [team, lead, handoff]);
    await c1.query('BEGIN'); await c1.query('UPDATE team_members SET role=\'member\' WHERE team_id=$1 AND user_id=$2', [team, lead]);
    await rejects(c1.query('UPDATE team_members SET role=\'member\' WHERE team_id=$1 AND user_id=$2', [team, handoff]));
    await c1.query('ROLLBACK');
    await pool.query("UPDATE organization_members SET is_active=false WHERE organization_id=$1 AND user_id=$2", [org, lead]);
    await rejects(pool.query("UPDATE organization_members SET is_active=false WHERE organization_id=$1 AND user_id=$2", [org, handoff]));
    const left = await pool.query("SELECT count(*) FROM team_members tm JOIN organization_members om ON om.user_id=tm.user_id AND om.organization_id=$2 WHERE tm.team_id=$1 AND tm.role='lead' AND om.is_active AND om.role IN ('owner','admin','member')", [team, org]);
    equal(Number(left.rows[0].count), 1);
    console.log('Verified native overlapping invitation acceptance and last-writable-team-lead protection');
    c1.release(); c1 = null; c2.release(); c2 = null;
    await pool.end();
    const reopened = new Pool({ connectionString: connection });
    try { equal(Number((await reopened.query('SELECT count(*) FROM users WHERE github_id=$1', [identity.id])).rows[0].count), 1); } finally { await reopened.end(); }
    console.log('Native fresh-connection persistence verified. Disposable branch must be deleted by the caller.');
  } finally {
    // No parent cleanup/data deletion ever occurs here. All writes are on the
    // explicitly selected disposable branch; branch deletion is an external step.
    if (c1) { await c1.query('ROLLBACK').catch(() => {}); c1.release(); }
    if (c2) { await c2.query('ROLLBACK').catch(() => {}); c2.release(); }
    await pool.end().catch(() => {});
  }
});
