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

## Batasan

- Vite masih memberi warning chunk besar (main sekitar 1.87 MB; editor sekitar 800 KB). Build berhasil; route-level bundle optimization bukan bagian perubahan ini.
- Screenshot/keyboard checks tidak menggantikan audit screen reader dan semua browser/device fisik.
- Tidak ada verifikasi live GitHub OAuth/webhook, deployment, perubahan database, perubahan role, atau pengiriman email dalam tugas ini.
