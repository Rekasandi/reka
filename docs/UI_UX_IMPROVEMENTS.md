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

## Projects grouped list sesuai screenshot

Halaman `/projects`, termasuk scope `?teamId=…`, kini memakai grouped list seperti referensi screenshot 15 Oktober 2026 pukul 22.19: toolbar ringkas, header grup status dengan disclosure/count dan tombol `+`, serta kolom Name / Health / Priority / Lead / Target date / Issues / Status. Ikon project memakai icon yang tersimpan (fallback existing), bukan tombol pengeditan dekoratif. Health berupa indikator ringkas; progress tetap angka/meter dari API, tanpa sparkline, milestone, atau umur update rekaan. Status tetap enum REKA existing, bukan menambah Accepted/Proposal/Idea dari contoh.

Filter status dan health digabungkan melalui menu; pencarian nama, clear filters, sorting A–Z/Z–A, dan pilihan grouped/ungrouped benar-benar bekerja. Scope dan query string detail dipertahankan. Tombol create per grup memakai dialog/hook existing dengan default status grup; daftar tim hanya writable, dan guest/client/tim read-only tidak memperoleh tombol create. Tidak ada perubahan kontrak API, dependency, migrasi atau data production. Pencarian/pagination server dan virtualisasi bukan bagian refinement ini; pencarian nama masih pada daftar yang dimuat API existing.

Responsive memakai container query berdasarkan lebar area Projects, bukan lebar viewport saja. Di area sempit, metadata turun ke bawah nama; header grup memakai colspan sesuai jumlah kolom terlihat agar native table tidak membuat kolom kosong yang menghimpit nama. Keyboard disclosure, name sorting, menu filter/display, native detail link, serta loading/error/retry/empty states diuji.

Verifikasi: `projects-list.mjs` lulus dengan create payload per grup, kombinasi filter, collapse/ungroup, sorting, permission fixtures, team scope, fallback data kosong/invalid, dan **12 ukuran/theme** (320/390/768/900/1024/1440px × light/dark). `project-detail-layout.mjs`, `pnpm test:web:real-api` (Nest + PostgreSQL disposable), web build/type-check dan `git diff --check` lulus. Audit aplikasi **39 routes × 4 variants = 156 renders**, tanpa overflow, clipped controls/headings/actions, atau page exceptions. Evidence lokal: `/tmp/reka-projects-grouped-audit/results.json`, `/tmp/reka-projects-grouped-{dark,light}-*.png`, `/tmp/reka-projects-grouped-{test,detail,real-api,build}.log`. Visual/interaction suites memakai API/auth terkontrol; bukan bukti load test atau provider live.

## Projects mengikuti DESIGN.md

Refinement lanjutan mempertahankan grouped list dan semua perilakunya, tetapi menyelaraskan visual dengan token aplikasi pada `DESIGN.md`:

- Geist **heading-md 20/28px, weight 600, tracking −0.4px** untuk judul; **body-md 14/20px** untuk tabel; metadata mobile/caption tetap 12/16px.
- **New project** memakai primary ink button existing dengan radius **6px**, bukan ghost action atau pill CTA marketing. Kontrol filter/display berbentuk lingkaran, sedangkan **All projects** menjadi category pill ber-hairline yang terbaca.
- Hairline antarrow, neutral secondary surface untuk header grup, radius grup 6px, serta spacing utama 16px. Tidak menambah card, bayangan, hero, uppercase dekoratif, atau gradient.
- Status berjalan/paused dan prioritas non-urgent memakai warna netral. Aksen hanya untuk kondisi semantik: completed/on-track, risiko, off-track, dan urgent. Ikon priority Projects bersifat lokal; picker/warna Issues tidak diubah.
- Toolbar mobile terpisah menjadi dua baris agar pencarian tidak terhimpit; primary action dan kontrol filter/display memiliki target 44px. Container-query metadata dan colspan responsive tetap dipertahankan.

`projects-list.mjs` menguji computed styles terhadap ukuran/font/tracking, palette per theme, radius, circular controls, hairline, contrast teks/primary ≥4.5:1, dan target sentuh; sekaligus mempertahankan pengujian filter, grouping, create payload, scope/permissions dan keyboard. **12 ukuran/theme** lulus, web type-check/build lulus, dan audit **39 routes × 4 variants = 156 renders** tidak menemukan overflow, clipped controls/headings/actions, atau page exceptions. Evidence: `/tmp/reka-projects-design-{dark,light}-*.png`, `/tmp/reka-projects-design-audit/results.json`, `/tmp/reka-projects-design-{test,build}.log`. API/auth browser dimock; tidak ada perubahan API/database/dependency, dan `DESIGN.md` tidak diubah. Ini bukan audit WCAG/screen reader menyeluruh.

## Toolbar Projects dihapus

Sesuai pemilihan elemen `Project toolbar`, seluruh baris **All projects**, pencarian, filter status/health, dan display options dihapus, termasuk state/import/empty-state khusus filter yang tidak terpakai. Header Projects/New project, kolom properti, grouping status, disclosure/count, create per grup, serta sorting melalui header Name tetap tersedia. Panduan dan browser assertions diperbarui. `projects-list.mjs` (12 ukuran/theme), web type-check dan audit **156 renders** lulus; evidence `/tmp/reka-projects-no-toolbar-*`. Tidak ada perubahan API/database.

## Projects konsisten dengan My issues

Permintaan berikutnya menjadikan `/my-issues` sebagai referensi langsung. Catatan ini menggantikan treatment header/group/body Projects pada bagian sebelumnya, bukan mengembalikan toolbar yang sudah dihapus.

- `apps/web/src/components/common/work-list.tsx` menyediakan `WorkPageHeader` dan `WorkListGroupHeader`, dipakai bersama oleh Issues/My issues dan Projects. Header memiliki judul/count/deskripsi/action slot; grup memiliki native disclosure button, ikon, label/count, dan create yang hanya muncul ketika handler tersedia. Tidak menyalin issue filters, view controls, maupun Manage labels ke Projects.
- Header Projects tidak lagi full-bleed atau mempunyai border khusus. Gutter dan gap **20px** mengikuti My issues; judul **24/32px desktop, 20/28px mobile**, tracking **−0.03em** mengikuti referensi aktual tersebut. Metadata **12/16px**, judul baris **13/20px**, berubah menjadi **14/22px** pada container sempit; spacing/hover/separator mengikuti issue list. Primary button tetap radius **6px** dan mobile target **44px**.
- Header grup tidak lagi berupa filled status band. Shared header memakai label **12px/600**, count ringkas, hairline, serta create `+`; jarak antargrup **20px**. Sticky Projects diterapkan pada native table row, dengan wrapper overflow visible supaya tidak menciptakan scroll ancestor yang keliru. Responsive colSpan **2/7** dipertahankan. Nama panjang dapat dua baris di area sempit.
- Sorting Name, status grouping, scope tim, create status preset, izin, link detail, dan progress/tanggal aktual tetap dipertahankan. My issues menggunakan komponen shared tanpa menambah fitur baru; title/count grup sekarang seluruhnya satu tombol disclosure yang keyboard-accessible, bukan clickable div. Simbol `▲` non-interaktif di sebelah count dihapus.
- Verifikasi: web type-check dan production build; `projects-list.mjs` pada **12 viewport/theme**, perbandingan computed-style Projects vs My issues untuk desktop/mobile × dark/light, sticky desktop/mobile untuk kedua daftar, dan audit **39 route / 156 renders**. Regresi `issue-row-properties.mjs` (grouped/flat/board, context menu, inline updates, subtasks, keyboard/mobile) dan `project-detail-layout.mjs` juga lulus; penanda parity memakai `data-work-list-row`, tidak menimpa `data-slot` milik Radix. Evidence `/tmp/reka-projects-consistent-*`, parity `/tmp/reka-projects-consistent-final-interactions/projects-issues-parity.json`. Browser/API dikontrol fixture; tidak mengubah data produksi atau membuktikan live provider/audit aksesibilitas menyeluruh.

## Triage workbench sesuai referensi

Referensi: screenshot pengguna `Screenshot 2026-10-16 at 4.27.58 PM.png`. Antrean list-plus-modal diganti dengan workbench: antrean di kiri, detail issue di tengah, properties di kanan bila container cukup lebar. Struktur mengikuti referensi; identitas tetap Geist/`DESIGN.md`, bukan menyalin data, histori, atau Triage Intelligence/AI milik referensi.

- Judul **20/28px, 600, −0.4px**; isi **14/20px** dan metadata **12/16px**; neutral semantic surfaces, hairline, dan app controls **6px**. Tidak ada dependency baru atau perubahan `DESIGN.md`.
- `TriagePage` mempunyai queue search judul/identifier, pilihan nyata dengan native button, reporter/tanggal aktual, URL `issueId` yang mempertahankan scope tim, serta empty/loading/error/retry. Layar sempit bergantian queue/detail, dengan fokus keyboard dipindahkan ke Back to queue dan dikembalikan ke item asal setelah render navigasi selesai.
- Reuse `IssueDetailContent` melalui presentation `triage`: title/description, compact property pickers, labels, subtasks, attachments/relations/recurrence/GitHub, subscription/favorite, dan activity/comments memakai hooks/API existing. Activity menjadi tab awal khusus triage. Container query menempatkan properties sesuai lebar pane, bukan lebar viewport. Toolbar keputusan sticky; detail kanonis dapat kembali ke pilihan triage semula.
- Accept/Decline/Duplicate membuka form khusus masing-masing. Routing hanya tim writable, status kerja aktif, dan eligible assignee; target duplicate bukan diri sendiri/issue archived/tim lain. Pending mencegah dismiss dan submit via tombol; inline error mempertahankan nilai. Setelah sukses, antrean/count dan pilihan berikutnya diperbarui. Edit/lifecycle issue juga meng-invalidasi queue; keputusan meng-invalidasi activity dan counter tim. Server authorization tidak diubah.
- Verifikasi: web type-check/production build; `triage-workbench.mjs` memakai actual app/router + controlled APIs (**14 viewport/theme**, keyboard/URL/history/reload/team scope, read-only, title/comments, accept/private routing, decline, duplicate, pending/error/retry/intake); `issue-detail-navigation.mjs` memastikan sheet/full page tetap bekerja. Audit **39 route × 4 = 156 renders** tanpa overflow/clipped controls/page errors.
- `pnpm test:triage`: **2/2** disposable Postgres/HTTP + migration preservation. `workflow-foundation-real-api.mjs`: browser → Nest HTTP → isolated Postgres untuk intake/templates/accept/assignee/decline/duplicate dan regresi workflow/project/initiative, termasuk restart. Evidence `/tmp/reka-triage-workbench*`, `/tmp/reka-triage-{types,build,api,real-api,detail-regression}.log`. Tidak ada perubahan database produksi, deployment, atau live provider; ini bukan audit aksesibilitas menyeluruh.

## Properties triage tetap terlihat

Refinement berikutnya menghapus border kiri pada panel **Issue properties** khusus triage dan menahannya di bawah toolbar saat artikel di-scroll. CSS sticky mengikuti seluruh delapan bagian konten, bukan hanya enam baris awal. Tinggi panel dibatasi terhadap pane review aktual; pada jendela pendek, properties mempunyai scroll sendiri sehingga Due date/Labels tetap dapat dijangkau. Di mobile/tablet yang tidak mempunyai kolom kanan, properties tetap inline dan tidak menutupi konten. Sheet/full-page issue lainnya tidak diubah.

Web type-check/build, `triage-workbench.mjs` (**14 layout/theme**, tambahan scroll artikel panjang pada 300px/1000px/ujung artikel dan tinggi jendela 900/560px × light/dark, border 0, akses dropdown Labels), serta `issue-detail-navigation.mjs` lulus. Evidence `/tmp/reka-triage-properties-{types,build,test,detail}.log`, captures `/tmp/reka-triage-workbench/properties-pinned-*.png`. Pengujian browser memakai controlled APIs; tidak ada perubahan API/database produksi.

## Kolom tengah triage full width dan rata kiri

Permintaan berikutnya menggantikan refinement 480px: batas lebar artikel, `max-w-6xl`, `mx-auto`, dan pemusatan grid triage dihapus. Artikel mengisi ruang tersisa dan rata kiri dengan gutter aplikasi. Properties tetap **220px**, sticky tanpa border kiri; antrean serta layout inline mobile/tablet tidak berubah. `triage-workbench.mjs` memeriksa full width/rata kiri pada **16 layout/theme**, termasuk viewport **1920px**, serta sticky pada konten panjang/jendela pendek. Web type-check/build dan browser regression lulus; evidence `/tmp/reka-triage-full-width-*` dan `/tmp/reka-triage-workbench/`.

## Properties inline di bawah judul triage

Referensi terbaru `Screenshot 2026-10-16 at 6.15.38 PM.png` menggantikan treatment panel kanan/pinned properties pada catatan sebelumnya. Judul **24/32px, 600, −0.48px**, full width/rata kiri; di bawahnya terdapat satu baris chip status, priority, assignee, project, estimate, label aktual, cycle, dan More properties. Pada container sempit chip membungkus tanpa horizontal overflow.

- Picker status/priority/assignee/project/cycle/type dan labels tetap memakai komponen/hooks existing. `IssueDetailContent` membagikan instance picker antara presentation triage dan field layout sheet/page; tidak menggandakan logika mutasi. Sheet/full-page mempertahankan tampilan sebelumnya.
- Estimate membuka Popover dengan input 0–100 dan **Save estimate**, termasuk nilai 0/clear; badge membaca nilai tersimpan, bukan draft. Type dan Due date tetap tersedia melalui **More properties** dengan **Save due date**. Portal diberi accessible name dan kontrol tetap disabled untuk read-only; tombol More properties tetap dapat dibuka untuk membaca nilai.
- `IssueLabelsPicker` mendapat appearance badge khusus triage: nama label pertama/warna asli dan jumlah tambahan. Trigger button/compact existing tetap default. Tidak ada label/data contoh yang ditambahkan ke aplikasi.
- Sidebar properties 220px, sticky/grid-span, dan size containment yang khusus menopangnya dihapus. Toolbar keputusan tetap sticky; antrean, scope, URL/history, Accept/Decline/Duplicate, serta aktivitas/komentar tetap tersedia.
- Verifikasi: web type-check/build; `triage-workbench.mjs` **16 viewport/theme**, urutan title→chips→description, satu baris desktop/wrap mobile, estimate 5/0/clear, edit Type/Due date, toggle label, portal, read-only, serta seluruh alur triage. `issue-detail-navigation.mjs`, `issue-row-properties.mjs` (grouped/flat/board), dan browser→Nest→isolated Postgres `workflow-foundation-real-api.mjs` lulus. Audit **156 renders** bersih. Evidence `/tmp/reka-triage-chips-*` dan `/tmp/reka-triage-workbench/`. Tidak ada perubahan database produksi/deployment/live provider.

## Team Members dan Settings: refinement product UI

Audit elemen pilihan pengguna pada `/teams/:id` menemukan header/key berulang, tablist pendek yang terpisah dari lebar konten, uraian role yang mendominasi daftar, privacy checkbox yang menyebar karena `Field horizontal` memakai `justify-between`, dan editor workflow dengan grid sempit/scroll internal. Perbaikan mempertahankan Geist, semantic tokens, `@reka/ui`, dan navigasi existing; pola hero/animasi marketing dari design-taste tidak diterapkan pada product UI ini.

- Header tim diringkas: icon tersimpan/fallback tim, nama, deskripsi, jumlah anggota/issue aktual dan prefix yang benar. Tidak lagi menampilkan key tiga kali atau `ENG-1` seolah itu prefix. Overview/Members/Settings tetap URL-driven dengan manual keyboard activation; tab bar memakai seluruh lebar konten. Tidak menambahkan submenu Members ke sidebar.
- Shared `TeamMembersPanel` memakai tabel native dengan identitas, workspace role informatif dan team role editable sesuai izin. Mobile memindahkan role workspace ke bawah identitas, mempertahankan role/action controls tanpa overflow. Help **Team roles** dapat dibuka dengan pointer/keyboard; proteksi last writable lead tetap disabled dengan penjelasan yang terhubung melalui `aria-describedby`. Add/remove/leave/confirm serta invite workspace tidak diubah semantiknya. Panel yang sama tetap dipakai pada Settings administration.
- Shared `TeamSettingsForm` membagi **General** dan **Issue workflow**, dengan label/helper dan input yang sejajar pada container cukup lebar, serta stack mobile. General dibatasi 768px; checkbox **Private team** tetap dekat labelnya. Workflow memakai baris datar dengan label mobile, key stabil, color/category/active aktual, page scrolling dan Save workflow tersendiri; tidak memperkenalkan reorder tanpa implementasi. Loading memakai Skeleton dan error tetap mempunyai Retry.
- Saat salah satu save pending, input/checkbox/add-state/save terkait dinonaktifkan; Delete team pada halaman utama juga menunggu save selesai. Add state tidak aktif jika workflow gagal/belum berhasil dimuat. Error save workflow mempertahankan draft. Delete tetap hanya pada capability existing dan membutuhkan konfirmasi, tidak ada penghapusan data asli.
- Verifikasi: web type-check/production build, `settings-navigation.mjs` (save/reload/privacy/workflow error/pending/retry, role help/last-lead, keyboard/history, serta **20 tambahan viewport/theme/tab renders**), audit seluruh app **39 route / 156 renders** tanpa findings. `workspace-access-real-api.mjs` memverifikasi UI → Nest → isolated Postgres untuk create/anggota/role/remove/leave/private access/restart dan non-admin lead; `pnpm test:workspace-access` **29/29** lulus. Evidence `/tmp/reka-team-polish-*` dan `/tmp/reka-team-polish/`. Tidak ada perubahan backend/schema/produksi/deployment; fixture success tidak membuktikan OAuth/GitHub live atau audit aksesibilitas menyeluruh.

## Baris Back to Teams dihapus

Sesuai pemilihan pengguna, baris navigasi **Back to Teams** pada `TeamDetailPage` dihapus beserta import ikon yang tidak terpakai. Header tim kini menjadi konten pertama; **Join team** tetap tersedia sesuai capability pada action area header, berdampingan dengan New Team Issue bila tersedia. Breadcrumb dan navigasi Teams existing tidak dihapus; Back to teams pada Settings administration tidak termasuk target. Web type-check/build, regresi Settings/team (termasuk assertion link yang dihapus pada desktop/mobile) dan isolated workspace browser flow lulus. Evidence `/tmp/reka-remove-team-back-*`.

## Color Picker untuk workflow dan labels

Gunakan composable **Dice UI Color Picker** berbasis Radix dari dokumentasi `/docs/components/radix/color-picker` melalui `@reka/ui`, mengganti native color input pada workflow tim dan Manage labels. Integrasi bersama berada di `apps/web/src/components/common/color-picker-field.tsx`; memilih area/hue, eyedropper browser yang didukung, dan edit nilai hex menyimpan warna lewat mutation/API yang sudah ada. Format output dikunci ke hex (tanpa alpha/format switch) sesuai nilai workflow/label existing. Komponen, visually-hidden form input, dan dua hooks ditempatkan di `packages/ui`; tidak menambah dependency atau mengubah schema.

Verifikasi: UI type-check/build dan `settings-navigation.mjs`, termasuk simpan dan reload hex dari workflow API mock, label color field, serta posisi popover pada 320/390px light/dark. Registry CLI Dice UI mengembalikan 404; komponen diadaptasi dari source yang tampil pada dokumentasi Radix resmi. Batasan: eyedropper hanya tersedia jika browser menyediakan EyeDropper API. Tidak membuktikan layanan provider live.

## Cycles timeline sesuai referensi

Menu `/cycles`, termasuk link Cycles/Current/Upcoming pada sidebar tim, mengganti list lama dengan timeline referensi `Screenshot 2026-10-16 at 7.30.50 PM.png`: rail tanggal dan titik, row tipis planned/upcoming/current/completed, capacity/success/scope sejajar, current terbuka otomatis, serta chart + ringkasan tiga baris. Hover pada baris cycle menyorot header secara penuh (full-width) dari garis rail vertikal hingga tepi kanan, dan tombol aksi `…` (titik tiga) hanya muncul saat dihover (tetap terlihat saat fokus keyboard, menu aktif, atau perangkat sentuh). Memakai shadcn `Collapsible`, `Tabs`, `Badge`, menu dan `ChartContainer` dengan Recharts yang sudah terpasang; tidak menambah dependency. Header app, route detail dan alur schedule/create/complete/rollover tetap dipertahankan.

Pengguna memilih **data aktual**. Scope/completed historis memakai snapshot; Started hanya titik/nilai saat ini menurut kategori workflow tim. Tidak menggambar area historis Started yang belum pernah direkam. Guide putus-putus diberi keterangan bukan forecast; weekend hatching berasal dari kalender. Kapasitas kosong/0/over tetap dibedakan. Query history lazy hanya untuk cycle terbuka; read-only tidak menampilkan aksi tulis. Tidak mengubah backend/schema/produksi.

Verifikasi: web build/type-check, `cycles-timeline.mjs` (10 viewport/theme, 320–2400px, sorting, kategori custom, kapasitas, URL/history, keyboard, readonly, error/empty/retry, tanpa request mutasi), `cycles-real-api.mjs` (current Started dan capacity, schedule persisten, history, atomic rollover melalui Nest + disposable Postgres), serta audit **39 route / 156 renders** tanpa findings. Detector changed targets: `[]`. Evidence `/tmp/reka-cycles-timeline/`, `/tmp/reka-cycles-timeline-audit/`, `/tmp/reka-cycles-timeline-*.log`. Review inline, bukan reviewer independen; tidak mengklaim pixel identity untuk angka/grafik yang berbeda karena data aktual, load test, OAuth live atau audit aksesibilitas penuh. `DESIGN.md` dipertahankan sebagai sistem incumbent.

## Metrics Insight aside pada halaman Issues

Sesuai referensi `Screenshot 2026-10-16 at 10.43.44 PM.png`, halaman Issues kini dilengkapi panel samping (aside) analitik metrik yang dapat dibuka melalui tombol **Insights** di toolbar desktop atau ikon grafik di search bar mobile:

- Header menampilkan jumlah total issue/estimate secara dinamis dari issue yang sedang difilter/dicari, tombol navigasi ke halaman penuh `/insights`, aksi `...`, dan tombol tutup `X`.
- Selector 3-kolom untuk mengonfigurasi dimensi analitik secara real-time: **Measure** (`Issue count` / `Estimate`), **Slice** (`Status` / `Priority` / `Assignee` / `Project`), dan **Segment** (`Priority` / `Status` / `None`).
- Grafik batang bertumpuk (stacked bar chart) berbasis Recharts + shadcn `ChartContainer`, dengan batang ramping (10px), grid garis putus-putus, dan sumbu Y di sisi kanan sesuai screenshot. Warna segmen mengikuti semantic tokens (merah Urgent, kuning High, biru Medium, hijau Low, abu-abu No priority).
- Tabel rincian di bawah grafik menampilkan icon status (lingkaran Todo, setengah lingkaran In Progress, tiga perempat In Review, dsb.), jumlah total, serta breakdown per kolom segmen.
- Footer menyediakan tombol **Set default for everyone** untuk menyimpan preferensi konfigurasi.
- Komponen berada di `apps/web/src/features/issues/components/issue-metrics-aside.tsx` dan terintegrasi ke `issues-page.tsx`. Desktop memakai aside sticky 400px; mobile memakai Sheet drawer samping kanan.
- Verifikasi: web type-check, build produksi, tes interaksi `issue-metrics-aside.mjs` (desktop, mobile sheet, ganti Measure/Slice/Segment, toast default, dan 3 screenshot light/dark), serta audit lintas halaman 39 route / 156 renders lulus tanpa finding.

## Batasan

- Vite masih memberi warning chunk besar (main sekitar 1.87 MB; editor sekitar 800 KB). Build berhasil; route-level bundle optimization bukan bagian perubahan ini.
- Screenshot/keyboard checks tidak menggantikan audit screen reader dan semua browser/device fisik.
- Tidak ada verifikasi live GitHub OAuth/webhook, deployment, perubahan database/role production, atau pengiriman email sungguhan dalam tugas ini.
