// Explicitly approved demo data only. No migration, deletion, provider calls,
// fabricated GitHub identities, or backdated workflow history.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const prefix = '[DEMO] ';
export async function seedDemo({ apiUrl, token, sql, owner, manifestFile }) {
  const manifest = manifestFile && existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : { version: 1, ownerId: owner.id, organizationId: owner.organizationId, steps: {}, records: {} };
  assert.equal(manifest.ownerId, owner.id, 'Manifest owner must match');
  assert.equal(manifest.organizationId, owner.organizationId, 'Manifest workspace must match');
  const save = () => { if (manifestFile) { mkdirSync(path.dirname(manifestFile), { recursive: true }); writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), { mode: 0o600 }); } };
  const record = (kind, key, row) => { (manifest.records[kind] ??= {})[key] = row; save(); return row; };
  const api = async (route, method = 'GET', body) => {
    const response = await fetch(`${apiUrl}/api${route}`, { method, headers: { authorization: `Bearer ${token}`, ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${JSON.stringify(data.message ?? 'Request failed')}`);
    return data;
  };
  const once = async (key, run) => { if (manifest.steps[key]) return; await run(); manifest.steps[key] = true; save(); };
  const ensure = async (kind, key, route, body, field = 'name') => {
    if (manifest.records[kind]?.[key]) return manifest.records[kind][key];
    const rows = await api(route);
    const found = rows.find(row => row[field] === body[field]);
    return record(kind, key, found ?? await api(route, 'POST', body));
  };
  const actor = await api('/auth/me');
  assert.equal(actor.id, owner.id, 'API actor must match the approved database owner');
  assert.equal(actor.role, 'owner', 'Demo seed requires workspace owner permission');
  const date = (days = 0) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
  const iso = days => `${date(days)}T00:00:00.000Z`;

  const teamDefs = [
    ['eng', 'DENG', 'Engineering Demo', false, 'Contoh delivery aplikasi dan API.'],
    ['design', 'DDES', 'Design Demo', false, 'Contoh discovery, UX, dan design system.'],
    ['ops', 'DOPS', 'Operations Private Demo', true, 'Contoh tim private; owner pembuat adalah lead dan anggota eksplisit.'],
  ];
  const teams = {};
  for (const [key, teamKey, name, isPrivate, description] of teamDefs) teams[key] = await ensure('teams', key, '/teams', { name: prefix + name, key: teamKey, isPrivate, description: prefix + description });

  for (const [key, name, role] of [['developer', 'Dina Developer', 'member'], ['designer', 'Bima Designer', 'member'], ['admin', 'Ari Admin Pending', 'admin'], ['guest', 'Gita Read-only Pending', 'guest'], ['client', 'Citra Client Pending', 'client']]) {
    await ensure('users', key, '/users?includeInactive=true', { name: prefix + name, email: `reka.demo.${key}@example.test`, role });
  }
  // Profiles are created through /users and remain pending/inactive. They cannot
  // sign in, masquerade as verified GitHub users, or bypass invitation acceptance.

  const clients = [];
  for (const [i, name, industry] of [[0, 'Nusantara Retail', 'Retail'], [1, 'Lintas Logistik', 'Logistics'], [2, 'Sehat Bersama', 'Healthcare'], [3, 'Aruna Finance', 'Finance']]) {
    clients[i] = await ensure('clients', String(i), '/clients', { name: prefix + name, industry, notes: prefix + 'Perusahaan fiktif untuk demonstrasi. Kontak example.test tidak dikirimi email.', contact: { name: prefix + `PIC ${name}`, email: `reka.demo.client${i}@example.test`, role: 'Product contact' } });
  }

  const defs = [
    ['store', 'eng', 0, 'Website Toko Nusantara', 'in_progress', 'on_track', 'high', -7, 7],
    ['payment', 'eng', 3, 'Audit Alur Pembayaran', 'completed', 'on_track', 'medium', -14, -1],
    ['onboard', 'design', 2, 'Redesign Onboarding', 'in_progress', 'at_risk', 'high', -3, 14],
    ['system', 'design', 0, 'Design System', 'planned', 'on_track', 'low', null, null],
    ['monitor', 'ops', 1, 'Monitoring Operasional', 'in_progress', 'off_track', 'urgent', -5, 3],
    ['runbook', 'ops', 1, 'Runbook Deployment', 'paused', 'at_risk', 'medium', -2, 10],
  ];
  const projects = {}, milestones = {};
  for (const [key, team, ci, name, status, health, priority, start, end] of defs) {
    const project = projects[key] = await ensure('projects', key, '/projects', { name: prefix + name, slug: `reka-demo-${key}`, teamId: teams[team].id, description: prefix + `Skenario fiktif ${name}. Gunakan issue, milestone, updates, dan dokumen untuk menjelajahi workflow. Tidak terhubung ke repository nyata.`, status, health, priority, startDate: start === null ? null : iso(start), targetDate: end === null ? null : iso(end) });
    await once(`client-${key}`, async () => {
      // Project/client association exists in the schema but has no current API
      // write field. Only this newly created demo project is updated directly.
      await sql`UPDATE projects SET client_id=${clients[ci].id}::uuid WHERE id=${project.id}::uuid AND organization_id=${owner.organizationId}::uuid AND name=${project.name}`;
    });
    milestones[key] = [];
    for (const [n, title] of ['Discovery dan Fondasi', 'Delivery dan Validasi'].entries()) milestones[key][n] = await ensure('milestones', `${key}-${n}`, `/projects/${project.id}/milestones`, { name: prefix + title, description: prefix + 'Tahap kerja contoh; progress dihitung dari issue yang dihubungkan.', targetDate: iso(n === 0 ? 2 : 7) });
    await ensure('documents', `project-${key}`, '/documents', { title: prefix + `Spesifikasi ${name}`, projectId: project.id, content: `${prefix}Dokumen fiktif\n\nTujuan: ${name}.\n\nAcceptance criteria:\n- Pekerjaan memiliki assignee, status, dan konteks project.\n- Validasi hasil melalui issue dan milestone.\n- Catat risiko di Updates.\n\nData demo dibuat saat ini; tidak ada histori delivery masa lalu atau integrasi provider yang dibuat-buat.` }, 'title');
    await once(`update-${key}`, () => api(`/projects/${project.id}/updates`, 'POST', { health, body: prefix + (health === 'on_track' ? 'Pekerjaan contoh berjalan sesuai rencana. Review hasil di milestone.' : 'Risiko contoh: dependency dan validasi perlu dituntaskan. Lihat issue blocked dan due date.') }));
  }

  const cycleDefs = [
    ['closed', 'eng', 'Evaluasi Delivery', -14, -1, 20],
    ['eng-active', 'eng', 'Sprint Engineering', -1, 12, 24],
    ['eng-next', 'eng', 'Sprint Berikutnya', 13, 27, 30],
    ['design-active', 'design', 'Sprint Design', -1, 12, 18],
    ['ops-active', 'ops', 'Sprint Operations', -1, 12, 12],
  ];
  const cycles = {};
  // Create the ended cycle first; current/future windows do not overlap it.
  for (const [key, team, name, start, end, capacity] of cycleDefs) cycles[key] = await ensure('cycles', key, '/cycles', { name: prefix + name, description: prefix + 'Periode rencana contoh. Snapshot dan penutupan direkam saat demo dibuat, bukan dibackdate.', teamId: teams[team].id, startDate: iso(start), endDate: iso(end), capacity });
  for (const [key] of teamDefs) await once(`schedule-${key}`, () => api(`/cycles/settings/${teams[key].id}`, 'PUT', { timezone: 'Asia/Jakarta', durationDays: 14, cooldownDays: 1, nextStartDate: date(28), autoCreate: false }));

  const labels = {};
  for (const [team] of teamDefs) {
    labels[team] = [];
    for (const [n, name, color] of [[0, 'Bug', '#ef4444'], [1, 'Customer experience', '#3b82f6'], [2, 'Maintenance', '#22c55e']]) labels[team][n] = await ensure('labels', `${team}-${n}`, '/labels', { teamId: teams[team].id, name: prefix + `${teams[team].key} ${name}`, color });
  }
  const tasks = {
    store: ['Validasi form checkout', 'Implementasi katalog produk', 'Review pencarian produk', 'Perbaiki login pelanggan', 'Optimasi gambar produk'],
    payment: ['Audit skenario pembayaran sukses', 'Uji transaksi ditolak', 'Dokumentasi hasil audit', 'Verifikasi webhook internal', 'Retrospektif checklist pembayaran'],
    onboard: ['Riset alur onboarding', 'Wireframe langkah pendaftaran', 'Review prototype', 'Validasi kontras dan aksesibilitas', 'Desain empty state'],
    system: ['Inventaris komponen', 'Definisi token warna', 'Rancang pola tabel', 'Dokumentasi pola form', 'Persiapan handoff komponen'],
    monitor: ['Aktifkan dashboard metrik', 'Definisi alert availability', 'Investigasi error sporadis', 'Uji threshold alert', 'Dokumentasi eskalasi insiden'],
    runbook: ['Tulis langkah deployment', 'Checklist rollback', 'Review checklist release', 'Verifikasi akses lingkungan', 'Arsipkan prosedur lama'],
  };
  const issues = {};
  for (const [key, team] of defs) {
    issues[key] = [];
    for (const [i, title] of tasks[key].entries()) {
      const finished = key === 'payment' || (i < 2 && ['store', 'onboard'].includes(key));
      const targetStatus = finished ? 'done' : i === 2 ? 'in_review' : i === 3 ? 'blocked' : key === 'system' ? 'backlog' : 'todo';
      const cycle = team === 'eng' && finished ? cycles.closed : cycles[`${team}-active`];
      const body = { title: prefix + title, description: `${prefix}Issue fiktif untuk demonstrasi workflow ${projects[key].name}.\n\nKriteria selesai:\n1. Implementasi dan pengujian diselesaikan.\n2. Catat hasil pada komentar.\n3. Perbarui status setelah verifikasi.\n\nTidak ada PR GitHub nyata untuk issue demo ini.`, teamId: teams[team].id, projectId: projects[key].id, assigneeId: i === 4 ? null : owner.id, status: 'todo', priority: ['high', 'medium', 'high', 'urgent', 'low'][i], type: i === 0 || i === 3 ? 'bug' : 'task', labelIds: [labels[team][i % 3].id], estimate: i === 4 ? null : [3, 5, 2, 0][i], dueDate: iso(i === 3 ? -2 : i + 1), cycleId: cycle.id };
      const issue = issues[key][i] = await ensure('issues', `${key}-${i}`, '/issues?includeArchived=true', body, 'title');
      await once(`issue-workflow-${key}-${i}`, async () => {
        if (finished || targetStatus === 'in_review') await api(`/issues/${issue.id}`, 'PATCH', { status: 'in_progress' });
        await api(`/issues/${issue.id}`, 'PATCH', { status: targetStatus });
        await api(`/projects/${projects[key].id}/milestones/${milestones[key][i < 2 ? 0 : 1].id}/issues/${issue.id}`, 'POST');
      });
    }
    await once(`comments-${key}`, async () => {
      await api(`/comments/by-issue/${issues[key][0].id}`, 'POST', { body: prefix + 'Catatan demonstrasi: kriteria dan hasil validasi disimpan sebagai komentar issue. Komentar ini dibuat oleh pemilik workspace saat pengisian demo.' });
      await api(`/comments/by-issue/${issues[key][3].id}`, 'POST', { body: prefix + 'Contoh hambatan: menunggu keputusan dependency. Gunakan relasi blocks untuk melihat keterkaitan pekerjaan.' });
      await api(`/issues/${issues[key][3].id}/relations`, 'POST', { type: 'blocked_by', relatedIssueId: issues[key][2].id });
      await api(`/issues/${issues[key][0].id}/subscription`, 'POST');
    });
  }
  await once('sub-issue', () => api(`/issues/${issues.store[4].id}`, 'PATCH', { parentId: issues.store[0].id }));
  await once('archive-example', () => api(`/issues/${issues.runbook[4].id}/archive`, 'POST'));
  await once('close-cycle', () => api(`/cycles/${cycles.closed.id}/complete`, 'POST', { incompleteIssuesAction: 'backlog' }));

  // Measured current samples only, scoped to newly created demo cycles. Do not
  // run the global worker sampler against unrelated existing real cycles.
  for (const key of ['eng-active', 'design-active', 'ops-active']) await once(`snapshot-${key}`, async () => {
    const cycle = cycles[key];
    await sql`INSERT INTO cycle_snapshots (cycle_id,snapshot_at,total_issue_count,completed_issue_count,remaining_issue_count,planned_estimate,completed_estimate,remaining_estimate,missing_estimate_count)
      SELECT ${cycle.id}::uuid,clock_timestamp(),count(*)::int,count(*) FILTER(WHERE s.category='completed')::int,count(*) FILTER(WHERE s.category IN ('started','unstarted'))::int,
      COALESCE(sum(i.estimate),0)::int,COALESCE(sum(i.estimate) FILTER(WHERE s.category='completed'),0)::int,COALESCE(sum(i.estimate) FILTER(WHERE s.category IN ('started','unstarted')),0)::int,count(*) FILTER(WHERE i.estimate IS NULL)::int
      FROM issues i JOIN team_workflow_states s ON s.team_id=i.team_id AND s.key=i.status
      WHERE i.cycle_id=${cycle.id}::uuid AND i.archived_at IS NULL AND s.category IN ('started','unstarted','completed')`;
  });

  for (const [key] of teamDefs) {
    await ensure('documents', `team-${key}`, '/documents', { title: prefix + `Cara kerja tim ${teams[key].key}`, teamId: teams[key].id, content: prefix + 'Tim contoh. Buka board untuk status, Cycles untuk kapasitas, dan Triage untuk intake. Owner pembuat tim terdaftar sebagai lead; profil pengguna demo masih pending dan bukan akun GitHub terverifikasi.' }, 'title');
    const template = await ensure('templates', key, '/issue-templates', { name: prefix + `Laporan bug ${teams[key].key}`, teamId: teams[key].id, titlePrefix: prefix, description: prefix + 'Form internal contoh; tidak ada URL publik.', defaultType: 'bug', defaultPriority: 'high', fields: [{ key: 'steps', label: 'Langkah reproduksi', type: 'textarea', required: true }, { key: 'impact', label: 'Dampak', type: 'select', required: true, options: ['Minor', 'Major', 'Critical'] }] });
    await once(`triage-pending-${key}`, async () => { record('intake', key, await api(`/issue-templates/${template.id}/submit`, 'POST', { title: `Laporan baru ${teams[key].key}`, answers: { steps: 'Data demo: isi form, kirim, periksa hasil.', impact: 'Major' } })); });
  }
  for (const action of ['accept', 'decline', 'duplicate']) await once(`triage-${action}`, async () => {
    const intake = await api(`/issue-templates/${manifest.records.templates.eng.id}/submit`, 'POST', { title: `Contoh keputusan triage ${action}`, answers: { steps: 'Contoh intake untuk melihat hasil keputusan dan activity.', impact: 'Minor' } });
    record('intake', action, intake);
    await api(`/triage/${intake.id}/${action}`, 'POST', action === 'accept' ? { status: 'todo', assigneeId: owner.id, projectId: projects.store.id, cycleId: cycles['eng-active'].id } : action === 'decline' ? { reason: prefix + 'Di luar scope contoh, keputusan tersimpan.' } : { relatedIssueId: issues.store[0].id, reason: prefix + 'Laporan mengulang issue validasi checkout.' });
  });

  const initiatives = {};
  for (const [key, name, status, health, keys] of [['experience', 'Pengalaman Pelanggan', 'in_progress', 'on_track', ['store', 'onboard', 'system']], ['reliable', 'Keandalan Delivery', 'in_progress', 'at_risk', ['monitor', 'runbook']], ['audit', 'Kualitas Pembayaran', 'completed', 'on_track', ['payment']]]) {
    initiatives[key] = await ensure('initiatives', key, '/initiatives', { name: prefix + name, description: prefix + 'Tujuan fiktif lintas project; progress berasal dari issue yang terhubung dan terlihat.', status, health, startDate: iso(-7), targetDate: iso(30) });
    for (const projectKey of keys) await once(`initiative-${key}-${projectKey}`, () => api(`/initiatives/${initiatives[key].id}/projects`, 'POST', { projectId: projects[projectKey].id }));
  }
  await once('project-dependencies', async () => {
    await api(`/projects/${projects.store.id}/dependencies`, 'POST', { dependsOnProjectId: projects.system.id });
    await api(`/projects/${projects.runbook.id}/dependencies`, 'POST', { dependsOnProjectId: projects.monitor.id });
  });

  const guide = await ensure('documents', 'workspace-guide', '/documents', { title: prefix + 'Mulai di sini — alur demo REKA', content: `${prefix}Panduan demonstrasi\n\n1. Buka My Issues untuk pekerjaan Anda.\n2. Pilih tim DENG, DDES, atau DOPS di Issues.\n3. Buka Triage dan review intake yang masih menunggu.\n4. Buka project Website Toko Nusantara untuk milestone, comments, dan attachment.\n5. Buka Cycles: cycle Evaluasi Delivery telah ditutup saat demo dibuat; cycle aktif memiliki snapshot aktual.\n6. Buka Insights dengan tanggal hari ini dan timezone Asia/Jakarta. Histori status dibuat saat pengisian, bukan data bulan lalu.\n7. Buka Users dan aktifkan filter semua akun untuk melihat profil demo pending. Profil ini tidak dapat login.\n8. Inbox berisi notifikasi simulasi bertanda [DEMO], bukan aktivitas anggota atau provider sungguhan.\n\nTidak ada email, branch/PR GitHub, deployment, atau pengaturan credentials yang diubah.` }, 'title');
  const archivedDoc = await ensure('documents', 'archived-example', '/documents', { title: prefix + 'Dokumen versi lama (arsip)', teamId: teams.eng.id, content: prefix + 'Contoh dokumen diarsipkan; restore sebelum mengedit.' }, 'title');
  await once('archive-document', () => api(`/documents/${archivedDoc.id}/archive`, 'POST'));

  for (const [key, name, mode, sort, filters] of [['priority', 'Prioritas tinggi', 'list', 'priority', { priorities: ['urgent', 'high'] }], ['mine', 'Pekerjaan saya', 'grouped', 'dueDate', { assigneeIds: [owner.id] }], ['board', 'Board Engineering', 'board', 'manual', { projectIds: [projects.store.id] }]]) {
    await ensure('views', key, '/views', { name: prefix + name, teamId: key === 'board' ? teams.eng.id : undefined, visibility: key === 'mine' ? 'private' : 'shared', config: { filterTab: 'all', viewMode: mode, groupBy: mode === 'list' ? 'none' : 'status', sortBy: sort, showSubtasks: true, filters: { assigneeIds: [], labelIds: [], priorities: [], projectIds: [], ...filters } } });
  }
  for (const [type, row] of [['issue', issues.store[0]], ['project', projects.store], ['view', manifest.records.views.priority], ['document', guide]]) await once(`favorite-${type}`, () => api('/favorites', 'POST', { resourceType: type, resourceId: row.id }));

  await once('attachments', async () => {
    for (const [name, content, issue] of [['demo-acceptance.txt', 'Data [DEMO]: checkout memvalidasi input wajib; gunakan file ini untuk mencoba download attachment.', issues.store[0]], ['demo-review.md', '# [DEMO] Checklist review\n\n- Periksa validasi\n- Periksa aksesibilitas\n- Verifikasi acceptance criteria\n\nTidak ada PR GitHub nyata.', issues.onboard[2]]]) {
      const form = new FormData(); form.append('file', new Blob([content], { type: name.endsWith('.md') ? 'text/markdown' : 'text/plain' }), name);
      const attachment = await api(`/attachments/by-issue/${issue.id}`, 'POST', form);
      record('attachments', name, attachment);
    }
  });
  await once('recurrence-stopped', async () => {
    await api(`/issues/${issues.monitor[4].id}/recurrence`, 'POST', { intervalCount: 1, unit: 'week', timezone: 'Asia/Jakarta', nextRunAt: iso(30), dueDateOffsetDays: 2 });
    await api(`/issues/${issues.monitor[4].id}/recurrence`, 'DELETE');
  });
  for (const key of ['pending', 'revoked']) await once(`invitation-${key}`, async () => {
    const invitation = await api('/workspace/invitations', 'POST', { email: `reka.demo.invite.${key}@example.test`, role: 'member', expiresInDays: 7 });
    // Never save or print the secret invitation URL.
    record('invitations', key, { id: invitation.id, email: invitation.email, role: invitation.role });
    if (key === 'revoked') await api(`/workspace/invitations/${invitation.id}/revoke`, 'POST');
  });
  await once('inbox-simulation', async () => {
    for (const [i, type, title, row, kind] of [[0, 'assignment', 'Issue contoh ditugaskan kepada Anda', issues.store[0], 'issue'], [1, 'mention', 'Contoh mention di diskusi', issues.onboard[0], 'issue'], [2, 'comment', 'Contoh notifikasi komentar', issues.store[3], 'issue'], [3, 'status_change', 'Contoh perubahan status', issues.payment[0], 'issue'], [4, 'project_update', 'Contoh update kesehatan project', projects.monitor, 'project']]) {
      await sql`INSERT INTO notifications (user_id,type,title,body,link,read,metadata) VALUES (${owner.id}::uuid,${type},${prefix + title},${prefix + 'Notifikasi simulasi untuk demonstrasi Inbox. Bukan mention/aktivitas anggota sungguhan dan bukan delivery provider eksternal.'},${kind === 'issue' ? `/issues?issueId=${row.id}` : `/projects/${row.id}`},${i === 4},${JSON.stringify({ demo: true, seed: 'reka-demo-v1', [kind === 'issue' ? 'issueId' : 'projectId']: row.id, ...(kind === 'issue' ? { issueIdentifier: row.identifier } : { projectName: row.name }) })}::jsonb)`;
    }
  });
  await once('inbox-links', async () => {
    // Support an earlier manifest while keeping all non-demo notifications untouched.
    for (const row of [issues.store[0], issues.onboard[0], issues.store[3], issues.payment[0]]) {
      await sql`UPDATE notifications SET metadata=metadata || ${JSON.stringify({ issueIdentifier: row.identifier })}::jsonb WHERE user_id=${owner.id}::uuid AND metadata->>'seed'='reka-demo-v1' AND metadata->>'demo'='true' AND metadata->>'issueId'=${row.id}`;
    }
  });
  manifest.completedAt = manifest.completedAt ?? new Date().toISOString(); save();
  console.log('Demo data created:', Object.fromEntries(Object.entries(manifest.records).map(([kind, rows]) => [kind, Object.keys(rows).length])));
  return manifest;
}

async function main() {
  assert.ok(process.argv.includes('--confirm-configured-database'), 'Requires explicit --confirm-configured-database. Never runs automatically.');
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env');
  const r = createRequire(new URL('../packages/database/package.json', import.meta.url));
  const { neon } = r('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  const email = process.env.REKA_DEMO_OWNER_EMAIL || 'rhezagustam@gmail.com';
  const owners = await sql`SELECT u.id,om.organization_id AS "organizationId" FROM users u JOIN organization_members om ON om.user_id=u.id WHERE lower(u.email)=${email.toLowerCase()} AND om.role='owner' AND om.is_active=true AND om.admission<>'pending'`;
  assert.equal(owners.length, 1, 'Exactly one active admitted owner workspace required');
  const owner = owners[0], token = randomUUID();
  await sql`INSERT INTO sessions(id,user_id,expires_at) VALUES (${token},${owner.id}::uuid,now()+interval '30 minutes')`;
  try { await seedDemo({ apiUrl: process.env.REKA_DEMO_API_URL || 'http://127.0.0.1:3000', token, sql, owner, manifestFile: process.env.REKA_DEMO_MANIFEST || '.pi/demo-data-v1.json' }); }
  finally { await sql`DELETE FROM sessions WHERE id=${token}`; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error('Demo seed stopped:', error instanceof assert.AssertionError ? error.message : error.code || error.name); process.exitCode = 1; });
