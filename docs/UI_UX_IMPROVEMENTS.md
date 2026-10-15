# UI/UX refinement — 14 Oktober 2026

## Cakupan dan arah

Permintaan: perbaiki seluruh aplikasi dengan **tetap mempertahankan gaya Linear**. Ini refinement frontend, bukan redesign produk, migrasi, deployment, atau kelanjutan goal workflow sebelumnya.

Identitas tetap: Geist, palette monokrom, hairline borders, semantic status colors, tabel/list yang ringkas, inline pickers, keyboard shortcuts, serta light/dark mode. Routes, API contracts, permission, dan data existing dipertahankan. Tidak ada dependency aplikasi baru.

## Masalah yang diperbaiki

| Area | Sebelum | Sesudah |
| --- | --- | --- |
| Navigasi | Semua tim terbuka, Organization tenggelam di bawah daftar; tidak ada akses All Issues di workspace | Kelompok personal/Workspace/Favorites/Your teams; halaman lain di More; tim pertama/current terbuka dan sisanya bisa dibuka; nama workspace berasal dari API |
| Mobile sidebar | Overlay tetap terbuka setelah pindah halaman | Menutup otomatis saat pathname/search berubah |
| Sidebar states | Tim fallback fiktif saat data kosong/gagal | Loading skeleton, Browse teams, dan retry yang nyata |
| Breadcrumb | Triage/Favorites/Documents/Initiatives/Roadmap memakai “Page”; detail memakai “Details” | Label halaman lengkap dan nama document/initiative aktual, dengan fallback netral saat unavailable |
| Issue toolbar | Filters/view controls terpotong ketika manager mempunyai semua tindakan | Controls wrap, display options dikelompokkan, search memiliki accessible name |
| Issue rows | Judul hampir tidak mendapat lebar di mobile dan di content area sempit | Container query berdasarkan **lebar list**, bukan hanya viewport: identifier/status → judul terbaca → metadata |
| Keyboard | Judul issue berupa span pada clickable div | Judul berupa tombol native; Enter membuka detail. Skip to content tersedia |
| Bulk actions | Floating bar terlalu lebar di mobile | Wrap dan dibatasi lebar viewport; Clear selection memiliki accessible name |
| Project list | Tidak ada filter nama; paused/canceled hanya ditemukan dari All; tahap project tidak terlihat langsung | Search/filter nama, filter Paused/Canceled, tahap project di bawah nama. Kolom, progress, tanpa icon dekoratif, dan struktur tabel lama tetap |
| Project detail | Tab Dependencies/Updates/Documents tidak berada di scroll container yang benar | Tabs scroll horizontal, bisa dibawa ke viewport melalui focus/click; properties tetap sticky di bawah toolbar |
| Dialogs | Form panjang bisa melewati layar pendek | Max height berdasarkan dynamic viewport, scroll internal, title tidak bertabrakan dengan Close |
| Settings | Halaman panjang tanpa navigasi bagian; Preferences tidak punya tujuan spesifik | Anchor navigation, Profile/Appearance destinations, pilihan Dark/Light/System menggunakan ThemeProvider existing |
| Identitas | Header menebak username GitHub dari email | GitHub identity hanya tampil jika account benar-benar mempunyai githubUsername |
| Konsistensi | Triage memiliki padding ganda/kicker; heading halaman baru berbeda | Gutter mobile 16px, desktop 24px; heading/copy selaras; loading triage memakai Skeleton shared |
| Touch/form | Banyak action utama terlalu kecil; input dapat memicu zoom iOS | Action utama mobile minimal 44px, compact controls diperbesar, input biasa 16px pada mobile |

Issue row di layar lebar tetap satu baris. Container query juga melindungi list yang menyempit karena filter panel atau karena di-embed pada project/cycle. Sub-issue indentation, checkbox order, right-side properties, badge variants, dan keyboard shortcuts existing tetap berfungsi.

## Verifikasi refinement awal

### Visual/interaction fixtures

`apps/web/test/all-pages-ui.mjs`: **24 routes/detail × desktop/mobile × dark/light = 96 renders**, termasuk Dashboard, Inbox, Issues/My Issues/Team Issues, Projects/detail, Teams/detail, Clients, Users, Cycles/detail, Settings, Triage, Favorites, Documents/detail, Initiatives/detail, Roadmap, Insights, Login, dan Not Found.

API/auth audit ini **dimock**, tidak menulis database aplikasi. Checks meliputi:

- Tidak ada horizontal overflow, clipped heading/action/control, breadcrumb “Page”/“Details”, atau page exception pada renders tersebut.
- Mobile navigation menutup sidebar setelah memilih All Issues.
- Judul issue mendapat lebar yang berguna, termasuk copy panjang pada 320/768/1024px.
- Native Enter membuka issue detail; skip link memindahkan focus ke content.
- Dialog tetap di viewport 390×480; tombol submit bisa dicapai dengan scroll.
- Project tab Documents yang awalnya offscreen bisa diakses.
- Filter project bekerja untuk hasil ada/kosong.
- Profile tanpa githubUsername tidak menampilkan GitHub identity palsu.
- Theme preference berubah dan tersimpan di browser fixture.
- Empty/error/retry team states tidak membuat resource fallback palsu.

Regression checks lulus: `header-breadcrumb.mjs`, `projects-list.mjs`, `clients-list.mjs`, `issue-row-properties.mjs` (grouped/flat/board, inline writes dan nested sub-issues), `project-detail-layout.mjs` (draft persistence, properties, tabs), dan `sticky-section-header.mjs`.

Fixture lama diperbarui agar cocok dengan API saat ini: workflow states, labels, workspace, recurrence null, document/initiative details, serta burndown berbasis snapshot aktual. Assertions perilaku tetap dipertahankan.

### Browser → API → database terisolasi

Kelima suite lulus:

- `pnpm test:web:real-api`
- `pnpm test:web:workspace`
- `pnpm test:web:cycles-real-api`
- `pnpm test:web:collaboration-real-api`
- `pnpm test:web:insights-real-api`

Suite memakai Nest API dan PostgreSQL terisolasi, bukan database aplikasi existing. Denial 400/404 yang diharapkan dan optional dev-server `/live.js` connection failures bukan kegagalan acceptance. Logging collaboration sekarang hanya menyebut status/path, bukan query strings/token atau response body.

Build: **10/10 tasks**. Type-check: **18/18 tasks**. `git diff --check`: bersih. Detector pada area perubahan: 0 anti-pattern failures, dengan dua advisory 10px untuk caption/key compact; bukan bukti sertifikasi WCAG penuh.

Evidence lokal: `/tmp/reka-ui-ux-before/`, `/tmp/reka-ui-ux-confirm/`, `/tmp/reka-ui-ux-build-final.log`, `/tmp/reka-ui-ux-types-final.log`, serta `/tmp/reka-ui-ux-{real-api,workspace,cycles,collaboration,insights}.log`.

## Sidebar sesuai referensi Linear

Permintaan lanjutan memakai screenshot sidebar Linear (14 Oktober 2026, 10.45 PM):

- Personal: Inbox dengan unread count aktual, My issues.
- Workspace: Initiatives, Projects, Views, More. Menu lain tetap tersedia di More, bukan dihapus.
- Favorites menampilkan link dari API existing, termasuk skeleton/empty/error/retry.
- Your teams: icon tim existing, private lock, Home/Triage/Issues/Cycles/Initiatives/Projects/Views; Current dan Upcoming berada di bawah Cycles.
- Triage/cycles/projects/initiatives dibatasi ke tim yang dipilih; initiatives merupakan tujuan workspace yang memiliki project tim tersebut. Views memakai API existing dengan scope tim. Tidak ada perubahan permission server.
- Chevron di dekat label, indentation tanpa garis tim berlebih, satu garis untuk cycle children, desktop rows 32px dengan label 14px, mobile navigation rows/disclosure 44px.
- Agent/Loops tidak dipalsukan. Tambahan hanya index `/views`; tidak ada dependency, migration, database write, atau deployment.

Verifikasi terbaru: `all-pages-ui.mjs` **25 routes × 4 variants = 100 renders**, tanpa page exception, horizontal overflow atau clipped controls/headings/actions. Interaction checks meliputi More/mobile close, disclosure keyboard, favorites states, private lock, guest New team visibility, active scope, team cycles/current/upcoming, initiatives/project/view filtering dan penerapan saved view. `header-breadcrumb.mjs`, `pnpm test:web:real-api`, dan `pnpm test:web:cycles-real-api` lulus. Web build/type-check dan `git diff --check` lulus; detector perubahan sidebar/views mengembalikan 0 findings.

Evidence: `/tmp/reka-sidebar-linear-final/results.json`, `/tmp/reka-sidebar-ui-final.log`, `/tmp/reka-sidebar-{real-api,cycles,build,types-final}.log`. API/auth visual harness dimock; real-api suites memakai PostgreSQL terisolasi, bukan database aplikasi.

## Detail issue: sheet + halaman penuh

Refinement berikutnya berfokus pada ruang kerja issue, bukan penggantian identitas seluruh aplikasi:

- Desktop list/board membuka Sheet; **Open full page**, Inbox, pencarian command palette dan mobile membuka `/issues/:id`.
- Konten/aksi tetap satu implementasi. Halaman penuh menempatkan properties di kolom samping desktop; title, description, sub-tasks dan discussion menjadi fokus. Attachments, relations, recurrence dan GitHub memakai Collapsible, bukan tumpukan card.
- Header lebih tenang; tindakan copy/archive/restore/delete berada di DropdownMenu. Konfirmasi delete memakai AlertDialog existing. Fields, Select, Button, Skeleton dan Alert memakai shadcn dari `@reka/ui`; tanpa dependency baru.
- Breadcrumb/title/link langsung mengambil detail dari API; label dan workflow detail disamakan dengan list setelah access check. Guest/client, tim read-only dan issue archived tidak menawarkan edit utama. Cache subtask ikut diperbarui setelah mutation.

Verifikasi: web build dan web/API type-check lulus; `pnpm test:issues` **5/5** termasuk metadata detail/private-team access; `pnpm test:web:issue-detail`, `pnpm test:web:real-api` dan `pnpm test:web:collaboration-real-api` lulus. Audit `all-pages-ui.mjs` sekarang **26 routes × 4 variants = 104 renders**. Tes mencakup direct/reload/back/forward, mobile, Inbox, shared edits, subtask completion, read-only, loading/error dan light/dark. API fixture tidak membuktikan provider live; suite real-API hanya menulis PostgreSQL disposable.

Evidence lokal: `/tmp/reka-issue-detail/`, `/tmp/reka-issue-ui-audit/results.json`. Panduan alur: `docs/ISSUES_WORKFLOWS.md`.

## Settings sebagai ruang pengaturan tersendiri

`/settings` membuka Preferences dan mengganti sidebar workspace dengan sidebar Settings. Kategori: Personal (Preferences/Profile/Connected accounts), Issues (Workflows/Labels), Projects (Project settings), Integrations (GitHub), serta Administrations (Workspace/Members/Teams, owner/admin). Setiap menu memiliki route `/settings/:section`; Back to workspace mengembalikan navigasi normal. Breadcrumb, document title, menu profil dan tautan hash/callback lama mengikuti tujuan baru.

Tidak ada konfigurasi palsu atau dependency baru. Theme dan notifikasi menggunakan penyimpanan existing; profil/identitas tetap read-only; workflow dan labels membuka editor tim existing; project settings mengarahkan ke konfigurasi per-project. GitHub UI dipisahkan dari pengaturan pribadi, sehingga Preferences tidak mengambil data instalasi/repository. Otorisasi API tidak berubah.

Verifikasi: web build/type-check, `pnpm test:web:settings`, `header-breadcrumb.mjs`, dan `pnpm test:web:collaboration-real-api` lulus. Audit `all-pages-ui.mjs`: **35 routes × 4 variants = 140 renders**, tanpa exception/overflow/clipped control. Suite Settings memakai router aplikasi nyata dengan API terkontrol: sidebar berganti, semua kategori, tema persisten, penyimpanan preferensi notifikasi, workflow/label dialogs, direct/reload/back/forward, legacy links, mobile/light/dark, guest denial dan retry. Collaboration tetap memakai API/PostgreSQL disposable; provider live dan deployment tidak diverifikasi.

Evidence lokal: `/tmp/reka-settings/`, `/tmp/reka-settings-audit/results.json`. Chip status, priority, type, assignee, project dan cycle di issue detail juga kembali memakai background/border existing, bukan override transparan.

## Teams di Administrations

`/settings/teams` menyediakan direktori tabel shadcn dengan filter nama/visibilitas, pengurutan nama, entry Create team, serta data anggota/issue/tanggal dari API existing. Nama tim membuka `/settings/teams/:teamId` tanpa meninggalkan Settings. Pengelolaan anggota, dialog tambah anggota dan pengaturan tim memakai API/hook existing; panel anggota dibagi dengan halaman tim biasa. Selector anggota kini dapat dipilih dengan keyboard, sementara remove/leave membutuhkan AlertDialog. Tim privat tetap membutuhkan membership eksplisit; role workspace tidak ditimpa oleh role tim dan lead writable terakhir tetap dijaga server.

Verifikasi: build/type-check web, `pnpm test:web:settings`, `header-breadcrumb.mjs`, `pnpm test:workspace-access` (**29/29**), serta `pnpm test:web:workspace` lulus. Suite API/UI database disposable membuktikan add/role/remove/cancel/restart, penolakan demosi lead terakhir, dan penolakan admin non-member pada tim privat. Suite router nyata memakai API terkontrol untuk navigasi/keyboard/role/sidebar dan light/dark desktop/mobile. Audit terbaru **37 routes × 4 variants = 148 renders**, tanpa exception/overflow/clipped control; evidence `/tmp/reka-teams-audit/results.json` dan `/tmp/reka-settings/`. Tidak ada migrasi, deployment, perubahan data production atau dependency baru. Provider GitHub tetap contract fixture; `/live.js` dev-server dapat mencatat connection refusal non-API.

## Team management sebagai alur harian

- Sidebar tim menyediakan **Overview**, sedangkan **Members** hanya menjadi tab di halaman tim bersama **Overview / Settings** (bukan menu sidebar tersendiri). Lead tidak perlu mengakses Administration untuk mengelola timnya; Settings tim memakai form/workflow editor yang sama dengan dialog existing. Delete team dipindahkan dari ikon dominan ke Settings dengan konfirmasi dan penjelasan cascade issue.
- Create team menjadi satu modal ringkas: nama, identifier auto-suggest yang tidak menimpa edit manual, pilihan visibility, deskripsi opsional. Validasi identifier sesuai API (maksimal 10 karakter, diawali huruf), error server inline, pending-safe. Pembuat otomatis Lead dan sukses membuka Members.
- Panel Members bersama menyediakan pencarian nama/email, penjelasan role, picker role, menu `…` untuk remove/leave, dan konfirmasi. Lead writable terakhir tidak bisa didemosi/dihapus melalui UI; server tetap sumber otorisasi.
- Add member menggunakan Command shadcn dengan pencarian dan navigasi keyboard, state loading/error/retry, serta role Lead/Member/Viewer. Ini hanya memasukkan pengguna workspace existing. **Invite to workspace** membuka dialog undangan existing bagi owner/admin, tanpa menumpuk modal dan tanpa auto-team admission. Lead biasa tidak mendapat izin undangan workspace. Label **Workspace role** membedakannya dari **Team role**.
- Tab berbasis URL mempertahankan reload/back/forward. Aktivasi tab manual (panah untuk fokus, Enter/Space untuk aktivasi) mencegah push history ganda dari mouse/focus Radix. Sidebar active state dan breadcrumb mengikuti tab.

Verifikasi: build/type-check web, `pnpm test:web:settings`, `pnpm test:web:workspace`, `pnpm test:web:real-api`, `header-breadcrumb.mjs`, dan **29/29** tes `pnpm test:workspace-access` lulus. Tes API/UI PostgreSQL disposable membuktikan create → Members, creator lead, role/remove/restart, Viewer read-only, pengelolaan lead non-admin tanpa hak invite workspace, serta isolasi tim privat. Tes router nyata/API terkontrol membuktikan validasi/error create, pergantian dialog undangan, pencarian, keyboard, satu history entry per tab, reload/back/forward, serta desktop/mobile light/dark. Audit terbaru **39 routes × 4 variants = 156 renders**, tanpa overflow/exception/clipped controls. Evidence: `/tmp/reka-team-flow-audit/results.json`, `/tmp/reka-settings/`. Tidak ada dependency baru, migrasi atau perubahan production.

## Batasan

- Vite masih memberi warning chunk besar (main sekitar 1.87 MB; editor sekitar 800 KB). Build berhasil; route-level bundle optimization bukan bagian perubahan ini.
- Screenshot/keyboard checks tidak menggantikan audit screen reader dan semua browser/device fisik.
- Tidak ada verifikasi live GitHub OAuth/webhook, deployment, perubahan database/role production, atau pengiriman email sungguhan dalam tugas ini.
