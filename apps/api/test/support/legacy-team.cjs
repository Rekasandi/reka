// Migration-preservation tests seed rows *before* the newest migrations run, so they must only name columns that
// existed back then. A drizzle `insert(teams)` also lists columns added later and fails on the older schema.
const { sql } = require('drizzle-orm');

async function insertLegacyTeam(db, { organizationId, name, key }) {
  const result = await db.execute(sql`INSERT INTO teams (organization_id, name, key) VALUES (${organizationId}::uuid, ${name}, ${key}) RETURNING id, organization_id AS "organizationId", name, key`);
  return result.rows[0];
}
/** Same idea for issues: later migrations add issue columns that a legacy schema lacks. */
async function insertLegacyIssue(db, { identifier, number, title, status, teamId, reporterId }) {
  const result = await db.execute(sql`INSERT INTO issues (identifier, number, title, status, team_id, reporter_id) VALUES (${identifier}, ${number}, ${title}, ${status}, ${teamId}::uuid, ${reporterId}::uuid) RETURNING id`);
  return result.rows[0];
}
module.exports = { insertLegacyTeam, insertLegacyIssue };
