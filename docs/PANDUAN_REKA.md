# Panduan REKA: Workflow, Cara Kerja, Penggunaan, dan Role

> Panduan pengguna untuk implementasi REKA saat ini. Diperbarui: 14 Oktober 2026.
> Nama menu/tombol mengikuti antarmuka aplikasi yang sebagian menggunakan bahasa Inggris.

## Daftar isi

1. [Apa itu REKA?](#1-apa-itu-reka)
2. [Istilah dan hubungan data](#2-istilah-dan-hubungan-data)
3. [Role dan hak akses](#3-role-dan-hak-akses)
4. [Memulai menggunakan REKA](#4-memulai-menggunakan-reka)
5. [Workflow pekerjaan dari awal hingga selesai](#5-workflow-pekerjaan-dari-awal-hingga-selesai)
6. [Panduan fitur](#6-panduan-fitur)
7. [Contoh penggunaan sehari-hari](#7-contoh-penggunaan-sehari-hari)
8. [Cara kerja aplikasi di belakang layar](#8-cara-kerja-aplikasi-di-belakang-layar)
9. [Kendala umum dan solusinya](#9-kendala-umum-dan-solusinya)
10. [Batasan dan referensi](#10-batasan-dan-referensi)

## 1. Apa itu REKA?

REKA adalah aplikasi internal perusahaan untuk merencanakan, mengerjakan, dan memantau pekerjaan software dalam **satu workspace bersama**.

REKA menghubungkan kebutuhan client, project, issue, pekerjaan tim, dan integrasi GitHub. Tim dapat menentukan penanggung jawab, berdiskusi, mengelola tenggat, memantau kemajuan, serta melihat laporan berdasarkan data yang tercatat.

REKA bukan portal publik client, aplikasi billing, atau pengganti GitHub. Pengelolaan kode, review kode, dan merge tetap dilakukan di GitHub; REKA menghubungkannya dengan pekerjaan yang direncanakan.

## 2. Istilah dan hubungan data

| Istilah | Pengertian | Contoh |
|---|---|---|
| **Workspace** | Ruang kerja bersama milik perusahaan; batas keanggotaan dan administrasi. | Rekasandi |
| **Team** | Kelompok yang memiliki anggota, issue, workflow status, dan cycles. | Engineering, dengan key `ENG` |
| **Client** | Catatan internal pelanggan beserta kontak dan project terkait. Bukan akun login. | Perusahaan ABC |
| **Project** | Kumpulan pekerjaan untuk mencapai hasil tertentu. | Website baru ABC |
| **Issue** | Unit pekerjaan yang dapat ditugaskan dan dilacak. | `ENG-42`: Perbaiki validasi form |
| **Sub-issue** | Pecahan pekerjaan yang terhubung ke issue induk. | Implementasi validasi dan pengujian |
| **Milestone** | Tahap pencapaian dalam project, dapat berisi beberapa issue. | MVP siap diuji |
| **Cycle** | Periode kerja tim dengan tanggal, scope issue, dan kapasitas estimasi. | Cycle dua minggu |
| **Initiative** | Tujuan lintas project, dengan status, kesehatan, dan target. | Tingkatkan pengalaman pelanggan |
| **Roadmap** | Tampilan jadwal project, milestone, initiative, dan dependency. | Rencana kuartal |
| **Triage** | Antrean tim untuk meninjau pekerjaan yang masuk. | Bug baru yang perlu diputuskan |
| **Inbox** | Notifikasi pribadi pengguna. | Anda disebut dalam komentar |
| **Document** | Dokumen teks tersimpan pada workspace, tim, atau project. | Spesifikasi fitur |
| **Saved view** | Konfigurasi tampilan issue yang disimpan. | Bug prioritas tinggi |

Hubungannya secara sederhana:

```text
Workspace perusahaan
├── Users / anggota workspace
├── Teams
│   ├── Anggota dan workflow status
│   ├── Issues → sub-issues, komentar, attachment, relasi
│   └── Cycles → issue yang direncanakan per periode
├── Clients → project terkait
├── Projects → issues, milestones, updates, documents, repositories
├── Initiatives → mengelompokkan projects
└── Roadmap dan Insights → membaca data yang dapat diakses pengguna
```

**Project dan cycle berbeda:** project menjawab “hasil apa yang ingin dicapai?”, sedangkan cycle menjawab “pekerjaan apa yang direncanakan pada periode ini?”. Issue dapat memiliki project sekaligus cycle.

## 3. Role dan hak akses

REKA memiliki beberapa lapisan role. **Role workspace tidak sama dengan role tim atau role project.** Hak akses selalu diperiksa oleh API, bukan hanya oleh tampilan tombol.

### 3.1 Role workspace

| Role | Fungsi dan hak utama | Batas penting |
|---|---|---|
| **Owner** | Mengelola workspace, undangan, anggota, integrasi, dan kepemilikan workspace. | Tidak otomatis bisa membaca tim private. Owner aktif terakhir tidak boleh dihapus, dinonaktifkan, atau diturunkan rolenya. |
| **Admin** | Administrasi workspace, undangan, anggota non-owner, dan integrasi. | Tidak boleh mengelola role owner atau menaikkan dirinya sendiri menjadi owner. Tidak otomatis masuk tim private. |
| **Member** | Pekerjaan sehari-hari; dapat membuat tim, bergabung ke tim public, dan bekerja sesuai izin tim/project. | Tidak mengelola administrasi workspace atau integrasi GitHub tingkat workspace. |
| **Guest** | Role akun lama yang dipertahankan sebagai pengguna internal read-only. | Tidak boleh mengubah data bersama, termasuk issue, komentar, atau file. |
| **Client** | Role akun lama yang dipertahankan sebagai pengguna internal read-only. | Bukan portal pelanggan eksternal dan bukan akses publik. |

Undangan baru mendukung role **member** atau **admin**. Role guest/client dipertahankan untuk akun lama; bukan model onboarding eksternal baru.

**Catatan:** menu **Clients** menyimpan data pelanggan. Role akun **client** adalah atribut pengguna. Keduanya berbeda, dan membuat data client tidak membuat akun login.

### 3.2 Role tim

| Role tim | Fungsi |
|---|---|
| **Lead** | Mengelola anggota dan pengaturan tim, termasuk workflow/labels/cycles yang memerlukan izin pengelola. Dapat mengerjakan issue jika role workspace mengizinkan. |
| **Member** | Mengerjakan issue tim, memperbarui properti, berdiskusi, dan mengunggah file sesuai izin. |
| **Viewer** | Membaca pekerjaan tim tanpa hak menulis issue/komentar. |

Aturan penting:

- **Tim public:** anggota workspace aktif dapat membaca. Untuk menulis issue/komentar, pengguna harus menjadi anggota tim dengan izin tulis, bukan sekadar dapat melihatnya.
- **Tim private:** harus menjadi anggota tim secara eksplisit untuk membaca. Aturan ini berlaku juga bagi owner/admin workspace.
- Owner/admin yang sudah memiliki akses dapat menjalankan operasi pengelolaan yang diizinkan server. Namun, operasi penulisan issue/komentar tetap memerlukan keanggotaan tim yang bukan viewer.
- Pembuat tim otomatis menjadi lead tim tersebut.
- Keanggotaan project tidak memberikan jalan pintas untuk masuk tim private.
- Role guest/client tetap read-only walaupun terdapat label role tim lama; role tim tidak bisa menaikkan izin workspace.
- Lead writable terakhir perlu handoff sebelum dapat dihapus/didemote atau dinonaktifkan.

Contoh: pengguna dengan role workspace **member** dan role tim **lead** dapat mengelola timnya, tetapi tidak dapat mengubah pengaturan workspace perusahaan.

### 3.3 Role dan tanggung jawab project

- **Project lead/owner:** penanggung jawab project; role keanggotaannya menggunakan `owner`. Ini bukan berarti pengguna tersebut menjadi owner workspace.
- **Project member:** anggota pekerjaan project; dapat menerima update project dan bekerja sesuai izin tim.
- Pengelolaan project dapat dilakukan oleh project lead/owner, team lead terkait, atau owner/admin workspace yang memiliki akses project.
- Anggota tim dengan izin tulis dapat membuat project pada tim tersebut. Mengelola anggota, lead, milestone, atau dependency memerlukan izin pengelola project.
- Lead dan anggota project memperoleh subscription update secara otomatis; masing-masing dapat berhenti mengikuti update.

### 3.4 Ringkasan izin praktis

| Tindakan | Izin yang dibutuhkan |
|---|---|
| Mengubah nama/pengaturan workspace | Owner atau admin workspace |
| Mengundang anggota, mengelola akun non-owner | Owner atau admin workspace |
| Mengelola kepemilikan workspace | Owner workspace |
| Membuat tim / bergabung sendiri ke tim public | Owner, admin, atau member workspace |
| Mengelola tim | Team lead atau owner/admin yang memiliki akses tim |
| Membuat/mengubah issue dan komentar | Workspace writable + anggota tim dengan izin tulis |
| Mengubah workflow, rename/delete label, mengelola cycle | Pengelola tim yang berwenang |
| Mengelola lead/anggota, milestone, dependency, repository project | Pengelola project yang berwenang |
| Membuat/mengubah dokumen workspace | Owner atau admin workspace |
| Membuat/mengubah dokumen tim atau project bertim | Izin tulis pada tim terkait |
| Menghubungkan GitHub App di workspace | Owner atau admin workspace |
| Melihat data private | Keanggotaan eksplisit pada tim private terkait |

Status akun juga berpengaruh: **pending** berarti belum diterima melalui undangan terverifikasi; **inactive** berarti akses telah dinonaktifkan. Keduanya bukan role baru, dan bukan izin untuk menggunakan workspace.

## 4. Memulai menggunakan REKA

### 4.1 Untuk owner/admin

1. Buka **Settings → Workspace** dan pastikan nama workspace sesuai.
2. Di **Users** atau pengaturan workspace, buat undangan menggunakan email GitHub yang sudah terverifikasi milik penerima.
3. Pilih role member/admin dan masa berlaku undangan.
4. Salin tautan undangan dan bagikan secara manual kepada penerima. REKA tidak otomatis mengirim email.
5. Buat tim melalui **Teams**, tentukan nama, key, dan visibility public/private.
6. Tambahkan anggota tim dan pilih role lead/member/viewer sesuai kebutuhan.
7. Konfigurasikan workflow tim; siapkan project dan cycle jika diperlukan.

Tautan undangan hanya ditampilkan saat diterbitkan, bersifat sekali pakai, dan dapat kedaluwarsa atau dicabut. Jika tautan hilang, cabut dan terbitkan kembali.

**Membuat profil pengguna secara manual bukan pengganti undangan.** Profil pending harus menyelesaikan penerimaan undangan GitHub sebelum memperoleh akses aktif.

### 4.2 Untuk anggota yang diundang

1. Pastikan email pada undangan sudah terverifikasi di akun GitHub Anda.
2. Buka tautan undangan, lalu pilih sign-in GitHub.
3. Selesaikan autentikasi dan persetujuan GitHub.
4. Setelah diterima, buka **Dashboard** untuk melihat pekerjaan yang tersedia.
5. Buka **Teams** dan bergabung ke tim public yang relevan, atau minta pengelola menambahkan Anda ke tim private.
6. Buka **My Issues** untuk pekerjaan yang ditugaskan kepada Anda.

Memiliki akun GitHub saja tidak cukup: pengguna baru tetap memerlukan undangan workspace. Akun lama yang sudah disetujui dapat masuk sesuai pemetaan identitas terverifikasi dan keanggotaan aktifnya.

### 4.3 Menu utama

Sidebar mengikuti susunan Linear: **Inbox / My issues**, **Workspace** (Initiatives, Projects, Views, More), **Favorites**, dan **Your teams**. **More** membuka Dashboard, All Issues, Triage, Roadmap, Documents, Cycles, Insights, Favorites, Teams, Users, dan Clients. Settings tetap di bawah sidebar.

Buka nama tim untuk mengakses Home, Triage, Issues, Cycles (Current/Upcoming), Initiatives, Projects, dan Views. Submenu memfilter tim tersebut; initiatives menampilkan tujuan yang terhubung ke project tim. Favorites memakai referensi pribadi yang benar-benar tersimpan. Agent/Loops tidak ditampilkan karena belum tersedia di REKA.

| Menu | Gunakan untuk |
|---|---|
| **Dashboard** | Melihat pekerjaan yang perlu perhatian, target terdekat, cycle aktif, dan pekerjaan menunggu review. |
| **My Issues** | Fokus pada issue yang ditugaskan kepada pengguna saat ini. |
| **Issues** | Menelusuri, membuat, memfilter, dan mengelola issue yang dapat diakses. |
| **Triage** | Meninjau intake baru dan memutuskan penerimaan/routing. |
| **Inbox** | Membaca dan mengelola notifikasi pribadi. |
| **Projects** | Mengelola hasil pekerjaan, milestone, progress, dan updates. |
| **Cycles** | Merencanakan scope kerja per periode tim. |
| **Initiatives / Roadmap** | Mengelompokkan tujuan lintas project dan melihat jadwal/dependency. |
| **Documents** | Menulis dan membaca dokumen yang sesuai scope akses. |
| **Insights** | Melihat metrik penyelesaian berdasarkan histori tercatat. |
| **Favorites** | Membuka referensi pribadi yang ditandai bintang. |
| **Views** | Mencari saved views dan membuka issue dengan filter/layout tersimpan. |
| **Teams / Users / Clients / Settings** | Struktur tim, anggota, catatan pelanggan, dan konfigurasi sesuai izin. |

### 4.4 Settings dengan sidebar khusus

Klik **Settings** untuk masuk ke halaman pengaturan. Sidebar workspace diganti sidebar Settings; **Back to workspace** kembali ke Dashboard.

| Kategori | Menu dan fungsi |
|---|---|
| **Personal** | **Preferences**: tema browser dan notifikasi Inbox. **Profile**: identitas akun yang sedang masuk. **Connected accounts**: identitas GitHub terverifikasi, bukan instalasi GitHub App workspace. |
| **Issues** | **Workflows** dan **Labels**: pilih tim, lalu gunakan pengaturan workflow atau label existing. Hanya pengelola tim yang dapat mengubahnya. |
| **Projects** | **Project settings**: pilih project untuk membuka konfigurasi properti, milestone, anggota, atau repository pada halaman project tersebut. Tidak ada default global project yang dipalsukan. |
| **Integrations** | **GitHub**: instalasi organisasi, repository workspace, aturan workflow yang didukung dan status webhook. Tindakan pengelolaan mengikuti izin owner/admin. |
| **Administrations** | **Workspace**, **Members**, dan **Teams**, khusus owner/admin. Teams menampilkan nama, deskripsi, visibilitas, jumlah anggota/issue, dan tanggal dibuat. Filter nama/visibilitas, urutkan nama, atau buat tim baru; klik nama tim untuk mengelola anggotanya. |

Setiap menu memiliki URL `/settings/...` yang bisa dibuka langsung atau di-reload. Tautan lama seperti `/settings#profile`, `/settings#appearance`, serta callback instalasi GitHub tetap diarahkan ke halaman yang sesuai. Di mobile, buka sidebar melalui tombol di header; sidebar menutup setelah memilih menu. Data profil tidak diedit melalui form palsu: identitas ditampilkan dari akun login yang sebenarnya.

### 4.5 Membuat dan mengelola tim

**Alur utama:** sidebar **Your teams → nama tim → Overview**, lalu tab **Members → Add member** di halaman tim, bukan harus melalui Administration. Members tidak menjadi menu sidebar tersendiri. Halaman tim memiliki tab **Overview / Members / Settings**; Settings hanya tersedia bagi pengelola tim. Tab tersimpan pada URL (`/teams/:id?tab=members` atau `?tab=settings`), mendukung reload/back/forward. Tombol panah memindahkan fokus tab; Enter/Space mengaktifkan tab.

- **Create team:** isi Team name, Identifier dengan saran otomatis yang tetap bisa diedit, Visibility (Workspace/Private), dan Description opsional. Pembuat otomatis menjadi Lead; setelah berhasil, halaman Members terbuka untuk menambahkan anggota.
- **Members:** cari nama/email, klik **Add member**, pilih anggota workspace, lalu tentukan **Lead / Member / Viewer**. Daftar memisahkan **Workspace role** (informasi akun) dari **Team role** (akses pada tim ini); di layar sempit, role workspace ditampilkan bersama identitas anggota. Tombol **Team roles** menjelaskan Lead/Member/Viewer tanpa memenuhi daftar dengan teks. Izin workspace tetap berlaku dan perubahan role tim tidak mengubah role workspace.
- **Settings:** bagian **General** mengatur nama, deskripsi dan **Private team**, lalu simpan melalui **Save settings**. Bagian **Issue workflow** mengatur nama/category/color/active setiap state dan disimpan terpisah melalui **Save workflow**. Key state tetap ditampilkan sebagai referensi, bukan field yang bisa diedit; perubahan urutan tidak ditawarkan melalui kontrol rekaan. Daftar workflow memakai scroll halaman dan menyusun ulang kontrol pada mobile. Ketika penyimpanan diproses, kontrol terkait dinonaktifkan; kegagalan workflow menampilkan error tanpa menghapus draft.
- **Remove/Leave:** buka menu `…` pada baris anggota, lalu konfirmasi. Akun workspace tidak dihapus. Role dan remove/leave lead writable terakhir dinonaktifkan dengan penjelasan; tambahkan lead lain terlebih dahulu. Proteksi server tetap berlaku.
- **Orang baru:** owner/admin dapat memilih **Invite to workspace** dari dialog Add member. Ini membuka dialog undangan existing, bukan otomatis menambahkan anggota tim. Tidak ada email otomatis; bagikan link satu-pakai. Setelah diterima, tambahkan pengguna ke tim. Lead non-admin diminta menghubungi owner/admin untuk undangan workspace.
- **Administrasi:** **Settings → Administrations → Teams** tetap menyediakan direktori lintas tim bagi owner/admin. Pengelolaan anggotanya memakai panel dan API yang sama; **Open team** membuka Members di ruang kerja biasa.

Tim privat hanya terlihat bagi anggota eksplisit, termasuk owner/admin. Pintu masuk baru ini tidak memberi akses tambahan ke tim privat.

## 5. Workflow pekerjaan dari awal hingga selesai

Alur yang direkomendasikan:

```text
Kebutuhan / laporan bug
        ↓
Template atau form internal → Triage
        ↓
Accept + routing / Decline / Duplicate
        ↓
Perencanaan project, milestone, assignee, prioritas, dan cycle
        ↓
Pengerjaan issue + sub-issues + diskusi
        ↓
Branch / PR GitHub → Review → Merge atau penutupan tanpa merge
        ↓
Status selesai + update project + penutupan cycle
        ↓
Insights dan evaluasi periode berikutnya
```

Alur ini **tidak wajib untuk setiap issue**. Pekerjaan yang sudah jelas dapat langsung dibuat dari **New Issue** tanpa melewati Triage. Project, milestone, cycle, dan GitHub linking digunakan sesuai kebutuhan.

### Langkah 1 — Intake dan triage

- Klik **+ / New intake** pada header antrean **Triage**, pilih form internal, isi judul dan field wajib, lalu kirim. Ikon **Templates** membuka pengelolaan form sesuai izin.
- Pengelola form menetapkan properti default; hasil pengiriman masuk ke kategori triage tim.
- Antrean berada di kiri; klik judul issue untuk membaca detail, description, properties, activity, dan comments tanpa meninggalkan triage. Properties kini berupa chip horizontal di bawah judul: status, priority, assignee, project, estimate, labels, dan cycle. Chip membungkus ke baris berikutnya pada layar sempit; tidak ada lagi panel Properties di kanan. **Estimate** membuka input dengan **Save estimate**; **More properties** menampilkan Type serta Due date dengan **Save due date**. Pengguna read-only tetap dapat melihat properti tambahan tanpa mengeditnya. Pada layar sempit, antrean dan detail bergantian; **Back to queue** mengembalikan fokus ke issue yang dipilih.
- Cari judul atau identifier melalui **Search triage**. Pilihan issue memakai URL `?issueId=...`, tetap mempertahankan `teamId`, serta mendukung reload dan Back/Forward. **Open full page** membuka detail kanonis dan dapat kembali ke pilihan triage semula.
- Dari toolbar detail, pilih tindakan berikut; form konfirmasi hanya menampilkan input yang sesuai:
  - **Accept:** menerima pekerjaan, memilih status kerja, tim tujuan, dan assignee yang memenuhi izin.
  - **Decline:** menolak dengan alasan; intake diarsipkan dan keputusan tercatat.
  - **Duplicate:** menghubungkan ke issue yang sudah ada; sumber intake tetap memiliki provenance dan diarsipkan.

Setelah keputusan berhasil, antrean diperbarui dan pilihan berpindah ke intake berikutnya bila tersedia. Jika gagal, form dan input tetap terbuka dengan pesan error; keputusan tidak bisa dikirim ulang atau ditutup ketika masih diproses. Pengguna read-only tetap dapat membaca intake yang diizinkan, tetapi tidak dapat mengubah properties atau membuat keputusan.

Triage adalah antrean pekerjaan **tim**, bukan notifikasi pribadi di Inbox. Form hanya untuk pengguna internal; tidak ada URL intake publik.

### Langkah 2 — Perencanaan

- Tentukan penanggung jawab dan prioritas.
- Hubungkan issue dengan project dan milestone bila ada.
- Isi estimate dan due date jika relevan.
- Masukkan ke cycle tim untuk pekerjaan yang direncanakan pada periode tertentu.
- Tambahkan dependency jika pekerjaan harus menunggu issue/project lain.

Estimate adalah nilai estimasi, bukan otomatis jam kerja. Sepakati satuan tim, misalnya story points, sebelum menggunakannya untuk kapasitas cycle.

### Langkah 3 — Pengerjaan dan kolaborasi

- Ubah issue ke status pengerjaan yang sesuai workflow tim.
- Pecah pekerjaan besar menjadi sub-issues.
- Catat pertanyaan, keputusan, hambatan, dan bukti melalui komentar/attachment.
- Gunakan mention untuk meminta perhatian anggota yang memiliki akses.
- Perbarui status dan assignee agar anggota lain tidak perlu menebak kondisi pekerjaan.

### Langkah 4 — Review dan GitHub

Jika integrasi GitHub sudah dikonfigurasi:

- Hubungkan repository yang sesuai dengan project.
- Sertakan identifier issue pada nama branch atau judul PR, misalnya `feature/ENG-42-validasi-form`.
- Link PR melalui issue detail jika belum terhubung.
- Buka PR di GitHub untuk review kode dan merge.

Webhook yang valid dapat memperbarui branch/PR, aktivitas, notifikasi, dan status issue. Target status mengikuti **kategori workflow tim**, bukan asumsi bahwa nama status selalu “In Review” atau “Done”. PR ditutup tanpa merge **tidak** otomatis dianggap selesai.

Integrasi memerlukan konfigurasi GitHub App, webhook secret, repository access, API, Redis, dan worker yang berjalan. Jika belum aktif, kelola status secara manual; jangan menganggap perubahan kode pasti sudah tersinkronkan.

### Langkah 5 — Penyelesaian dan evaluasi

- Pastikan pekerjaan benar-benar selesai, kemudian gunakan status berkategori completed.
- Tulis update project mengenai kemajuan atau risiko.
- Saat cycle ditutup, pengelola menentukan nasib pekerjaan belum selesai: ke backlog atau cycle berikutnya.
- Gunakan **Insights** untuk meninjau throughput, lead/cycle time, velocity, dan burndown dengan memperhatikan kelengkapan histori.

## 6. Panduan fitur

### 6.1 Issues

**Membuat issue:** buka **Issues → New Issue**, pilih tim, isi judul/deskripsi, lalu set properti yang dibutuhkan dan simpan.

Properti utama:

- **Status:** tahap kerja sesuai konfigurasi tim.
- **Type:** task, bug, feature, improvement, atau chore.
- **Priority:** no priority, low, medium, high, atau urgent.
- **Assignee:** penanggung jawab; boleh unassigned.
- **Labels:** kategori tambahan yang sesuai scope tim/project.
- **Estimate:** nilai 0–100 atau kosong; `0` berbeda dengan belum diestimasi.
- **Due date:** tenggat issue.
- **Project / Cycle:** konteks hasil pekerjaan dan periode perencanaan.

Buka issue untuk mengedit detail atau gunakan kontrol inline pada daftar/board. API memvalidasi asosiasi tim/project/cycle, assignee, dan izin; data yang tidak sesuai dapat ditolak meskipun pilihan terlihat di antarmuka.

**Status bawaan:** Backlog, Todo, In Progress, In Review, Ready to Deploy, Done, Canceled, Blocked, serta Triage. Tim dapat mengubah workflow melalui **Team → Settings → Workflow**.

Kategori status memiliki arti berbeda:

| Kategori | Arti |
|---|---|
| `triage` | Intake belum diputuskan. |
| `backlog` | Pekerjaan disimpan, belum masuk rencana aktif. |
| `unstarted` | Sudah direncanakan tetapi belum dimulai. |
| `started` | Sedang dikerjakan/review sesuai workflow tim. |
| `completed` | Selesai. |
| `canceled` | Dibatalkan, bukan penyelesaian pekerjaan. |

Kategori tersebut menentukan filter dan perhitungan progress. Mengganti nama “Done” saja tidak mengubah makna kategorinya. Status yang masih dipakai tidak boleh dihapus/dinonaktifkan sebelum issue dipindahkan.

**Sub-issues dan relasi:** gunakan sub-issue untuk memecah pekerjaan; gunakan blocks/blocked-by untuk dependency, related untuk keterkaitan, dan duplicate untuk duplikasi. Hubungan yang melingkar, lintas tim yang tidak sesuai, atau tidak dapat diakses ditolak.

**List dan board:** pilih list, grouped list, atau board. Grouping mendukung status atau tanpa grouping; sorting mendukung manual, recently updated, priority, dan due date. Filter dapat membatasi assignee, labels, priority, dan project.

- Seret card board ke kolom status untuk mengubah status dan memindahkannya ke bagian atas.
- Gunakan **Move to top** untuk pengurutan manual tanpa drag.
- Pilih checkbox beberapa issue untuk bulk action yang tersedia. Periksa hasil/error operasi, jangan menganggap semua item pasti berhasil.

**Archive/restore:** archive menyembunyikan issue dari daftar default tanpa membuang histori. Buka tab Archived dan pilih restore untuk mengaktifkannya kembali. Delete bersifat penghapusan, bukan archive; jangan mengandalkan undo yang tidak tersedia.

**Labels:** buat/pilih label dari picker issue. Pengelola tim menggunakan **Manage labels** untuk membuat, mengganti nama/warna, atau menghapus label tim. Menghapus label melepas assignment label, bukan menghapus issue.

**Recurring issue:** pada issue detail, atur interval, cadence hari/minggu/bulan, timezone, next occurrence, dan opsional due-date offset. Template properti disimpan saat konfigurasi; perubahan berikutnya pada issue sumber tidak otomatis mengubah template tersebut. Stop recurrence menghentikan pembuatan berikutnya, bukan menghapus issue yang sudah dibuat. Fitur otomatis memerlukan worker.

### 6.2 Projects dan milestones

Halaman **Projects** mengikuti pola **My issues**: judul dengan jumlah project yang dapat diakses, deskripsi singkat, tombol aksi di kanan, serta header grup ringkas dengan chevron, ikon status, nama, jumlah, dan tombol `+`. Tipografi, jarak, hairline, serta kepadatan baris juga disamakan. Klik header **In progress / Planned / Paused / Completed / Canceled** untuk menciutkan atau membuka grup; saat scroll, header grup tetap di bawah header aplikasi. Kolom desktop menampilkan nama/icon project, health, priority, lead, target date, jumlah issues, serta status/progress aktual; pada area sempit, nama dapat memakai dua baris dan metadata dipindahkan ke bawahnya.

- Header **Name** membalik urutan nama A–Z/Z–A di dalam grup status. Toolbar **All projects**, pencarian, filter dan display options sudah dihapus; daftar langsung berada di bawah header halaman.
- Tombol **+** pada grup membuka form project existing dengan status grup sebagai nilai awal. Scope tim tetap dipertahankan; hanya tim writable yang tersedia dalam form. Guest/client dan tim read-only tidak menampilkan tindakan create.
- Klik nama project untuk membuka detail. Data tanggal/progress yang belum tersedia tidak diberi angka atau grafik histori rekaan.

1. Buka **Projects**, buat project pada tim yang dapat Anda tulis.
2. Tentukan lead, status, health, prioritas, serta start/target date jika relevan.
3. Tambahkan anggota dan issue yang sesuai.
4. Buat milestone, tetapkan tanggal target, dan kelompokkan issue per tahap.
5. Tambahkan dependency ke project lain apabila benar-benar diperlukan.
6. Posting catatan pada **Updates**; pilih health sesuai kondisi terakhir.

Progress dihitung dari issue yang dapat diakses, bukan persentase yang diisi secara bebas. Issue yang diarsipkan tidak masuk perhitungan progress; pekerjaan canceled dikecualikan dari denominator penyelesaian. **Health** adalah penilaian kondisi project, berbeda dari progress.

Mengedit update lama tidak menimpa health yang berasal dari update terbaru. Pemindahan lead dan penghapusan anggota perlu dilakukan secara sadar karena memengaruhi pengelolaan dan subscription update.

### 6.3 Cycles

Menu **Cycles** kini menampilkan timeline seperti ledger: tanggal di kiri, cycle terbaru di atas, serta status, kapasitas dan scope di kanan. Cycle **Current** terbuka otomatis; klik baris atau Enter/Space untuk membuka/menutup grafik. Filter **All / Current / Upcoming / Completed** mempertahankan scope tim pada URL. Buka **Open cycle details** untuk perencanaan issue existing; menu `…` menyediakan tindakan sesuai izin. Grafik memakai shadcn Chart/Recharts, dengan ringkasan **Scope / Started / Completed** di kanan desktop dan di bawah grafik pada mobile.

- Buat cycle pada tim yang tepat, tentukan periode dan capacity jika dibutuhkan.
- Assign issue melalui properti **Cycle**.
- Periksa planned/completed/remaining estimate dan jumlah issue tanpa estimate.
- Melalui **Schedule settings**, pengelola dapat mengatur timezone, durasi, cooldown, next start, dan auto-create.
- Tutup cycle ketika evaluasi periode selesai; pilih backlog atau cycle berikutnya untuk pekerjaan belum selesai.

Cycle tidak boleh memiliki rentang tanggal kosong atau overlap dengan cycle terbuka pada tim yang sama. Pekerjaan completed/canceled/triage/backlog/archived tidak ikut rollover pekerjaan aktif. Reopen mempertahankan histori dan tetap memeriksa overlap.

Kapasitas tidak wajib. Nilai kosong berarti belum ditetapkan; nilai `0` adalah kapasitas yang secara eksplisit nol. Riwayat grafik hanya memakai snapshot yang benar-benar tercatat. Timeline juga menampilkan observasi saat ini untuk cycle aktif; **Started** merupakan nilai saat ini, bukan riwayat buatan. Garis putus-putus hanya panduan jadwal, bukan prediksi. Nilai yang belum tersedia tetap dijelaskan.

### 6.4 Initiatives dan Roadmap

- Buat initiative untuk tujuan lintas project, lalu isi owner, status, health, dan tanggal.
- Hubungkan project yang relevan dengan izin pengelolaan project.
- Gunakan **Roadmap** untuk melihat rentang tanggal, milestone, dan dependency.

Project/initiative membutuhkan start dan target date agar memiliki rentang timeline. Data tanpa tanggal yang cukup tampil sebagai **Unscheduled**, bukan diberi jadwal buatan. Progress dan dependency hanya menggunakan project yang dapat dibaca pengguna; hasil antar pengguna dapat berbeda karena akses private.

### 6.5 Documents

Buka **Documents**, pilih scope workspace, tim, atau project, lalu buat judul dan isi teks. Gunakan untuk spesifikasi, keputusan, catatan rapat, atau panduan internal.

- Scope workspace dikelola owner/admin.
- Scope tim/project mengikuti akses dan izin tulis terkait.
- Dokumen dapat diedit, diarsipkan, direstore, dicari, dan ditandai sebagai favorite sesuai izin.
- Dokumen yang diarsipkan tidak muncul dalam pencarian biasa.

Documents bukan editor multi-cursor atau public sharing. File biner seperti PDF diunggah melalui attachment issue, bukan sebagai isi dokumen.

### 6.6 Comments, mentions, subscriptions, dan attachments

- Gunakan komentar issue untuk diskusi; penulis dapat mengedit/menghapus komentar sendiri, dan owner/admin yang memiliki akses dapat memoderasi.
- Ketik `@` dan pilih anggota yang sesuai. Mention bukan cara memberi akses: penerima tetap harus memiliki akses issue.
- Gunakan **Follow issue** untuk mengikuti perubahan; unsubscribe untuk menghentikan subscription pribadi.
- Unggah attachment pada issue; maksimum **5 MiB**, satu file per upload.
- Format yang didukung: PNG, JPEG, GIF, WebP, PDF, teks UTF-8, dan Markdown UTF-8.

Upload memerlukan izin tulis, download memerlukan akses baca saat itu, dan delete memerlukan izin uploader/pengelola yang berwenang. File tidak memiliki tautan publik bebas akses. Attachment lama tanpa byte tersimpan dapat gagal diunduh; unggah ulang sumber file bila diperlukan.

### 6.7 Inbox dan preferensi notifikasi

Buka **Inbox** untuk membaca mention, assignment, komentar/update, undangan tim, dan informasi GitHub yang ditujukan kepada Anda.

- Filter berdasarkan kategori atau read/unread.
- Tandai satu/semua notifikasi sebagai dibaca.
- Hapus notifikasi pribadi atau bersihkan notifikasi yang sudah dibaca.
- Buka **Notification preferences** untuk mengatur kategori notifikasi baru.

Menghapus notifikasi tidak menghapus issue atau komentar sumber. Mematikan kategori tidak menghapus histori Inbox yang sudah ada. Jika akses private dicabut, notifikasi terkait tidak lagi ditampilkan. Notifikasi adalah in-app, bukan email atau push eksternal.

### 6.8 Saved views, Favorites, Search, dan shortcut

Setelah memilih filter/sort/group/layout issue, pilih **Save view**. Default-nya private/Only me. Publikasi shared view workspace atau tim memerlukan izin pengelola yang sesuai. Shared view tidak memberikan akses ke issue private dan tidak otomatis dapat diedit semua pengguna.

Gunakan bintang untuk menyimpan referensi pribadi pada **Favorites**. Hasil pencarian dan favorites selalu diperiksa terhadap izin terbaru.

| Shortcut | Fungsi |
|---|---|
| `Ctrl/Cmd + K` | Membuka command palette/pencarian. |
| `C` | Membuka pembuatan issue. |
| `/` | Fokus ke pencarian daftar issue. |
| `J/K` atau panah | Navigasi issue pada tampilan list/grouped. |
| `Enter/Space` | Membuka issue yang sedang difokuskan. |
| `G`, lalu `I` | My Issues. |
| `G`, lalu `P` | Projects. |
| `G`, lalu `D` | Documents. |
| `G`, lalu `N` | Initiatives. |
| `G`, lalu `R` | Roadmap. |
| `G`, lalu `S` | Settings. |
| `G`, lalu `F` | Favorites. |
| `G`, lalu `T` | Triage. |

Shortcut satu huruf tidak mengambil alih pengetikan dalam form/menu/dialog. Command palette mencari issue, project, dan document; pilih hasil untuk membuka data aslinya.

### 6.9 Insights

Pilih rentang tanggal, timezone, dan filter yang tersedia pada **Insights**.

| Metrik | Cara membacanya |
|---|---|
| **Throughput** | Jumlah issue dengan transisi completed pertama yang tercatat; re-completion ditampilkan terpisah. |
| **Lead time** | Waktu dari creation yang tercatat ke completion pertama yang teramati. |
| **Cycle time** | Waktu dari masuk kategori started pertama yang teramati ke completion pertama. |
| **Velocity** | Penyelesaian issue/estimate pada cycle yang selesai dan memiliki final snapshot tercatat. |
| **Burndown** | Sisa issue/estimate dari snapshot cycle yang benar-benar tersimpan. |

Tidak adanya histori bukan berarti nilai nol. Issue lama mungkin tidak memiliki creation/start history yang cukup untuk metrik durasi. Laporan menunjukkan jumlah sample dan histori yang hilang; tidak merekonstruksi masa lalu dari status saat ini.

Filter project/saved view berlaku pada laporan issue. Snapshot cycle bersifat cycle-wide sehingga tidak dapat dipotong secara jujur menggunakan filter project/saved view. Filter label menggunakan assignment label saat ini karena histori assignment label belum direkam.

### 6.10 Users dan Clients

**Users:** direktori anggota, undangan, role, serta aktivasi/deaktivasi sesuai izin. Deaktivasi menghentikan akses tanpa menghapus pekerjaan/komentar yang sudah dibuat. Role owner hanya dikelola owner; perubahan email login memerlukan proses relinking identitas terverifikasi, bukan edit profil biasa.

**Clients:** catatan internal pelanggan, industri, catatan, kontak, dan project terkait. Owner/admin/member dapat mengelola data client sesuai akses workspace; guest/client read-only. Jumlah dan daftar project terkait tetap mengikuti akses pengguna, termasuk privasi tim.

## 7. Contoh penggunaan sehari-hari

### Contoh: memperbaiki bug form pada project client

1. Anggota melaporkan bug melalui form internal Triage.
2. Reviewer menerima intake ke tim Engineering dan status Todo.
3. Issue `ENG-42` dihubungkan ke project Website ABC, milestone MVP, assignee, prioritas high, estimate 3, dan cycle aktif.
4. Assignee mengubah status menjadi In Progress dan membuat sub-issue pengujian bila perlu.
5. Developer membuat branch `fix/ENG-42-validasi-form`, lalu PR di GitHub.
6. PR dihubungkan ke issue; anggota berdiskusi dan memberikan review di GitHub.
7. Setelah merge, webhook yang aktif dapat memindahkan issue ke kategori completed. Jika integrasi belum aktif, status diperbarui manual berdasarkan hasil nyata.
8. Lead memeriksa progress milestone, memposting update project, dan menilai health.
9. Pada akhir cycle, sisa pekerjaan dievaluasi dan dipindahkan secara eksplisit.
10. Insights digunakan untuk mempelajari pola delivery, bukan untuk mengarang histori sebelum pencatatan tersedia.

### Rutinitas yang disarankan

- **Awal hari:** periksa Inbox, My Issues, dan Dashboard.
- **Saat mulai bekerja:** pastikan assignee, status, project, dan konteks issue benar.
- **Saat terhambat:** tulis alasan, relasi blocking bila relevan, dan mention pihak yang dapat membantu.
- **Saat selesai:** perbarui status berdasarkan hasil nyata dan sertakan bukti/PR.
- **Lead per periode:** tinjau Triage, kapasitas cycle, risiko project, dan pekerjaan rollover.
- **Owner/admin:** tinjau akses tim, undangan kedaluwarsa, dan akun yang tidak lagi perlu aktif.

## 8. Cara kerja aplikasi di belakang layar

```text
Browser / React
      ↓ request API dengan session
NestJS API
      ├── Validasi input
      ├── Autentikasi dan izin workspace/tim/project
      └── Query melalui Drizzle → PostgreSQL di Neon
                                      ↑
GitHub webhook → API → Redis/BullMQ → Worker
                                      ├── Memproses event GitHub
                                      ├── Membuat recurring issues
                                      └── Menjalankan jadwal/snapshot cycles
```

- **Frontend:** React/Vite, Tailwind, dan komponen `@reka/ui` menampilkan data dan mengirim perubahan ke API.
- **API:** NestJS memvalidasi input dan hak akses. Session yang valid saja tidak cukup; pengguna harus memiliki keanggotaan workspace aktif.
- **Database:** menyimpan data bersama, membership, undangan, issue, histori, komentar, preferensi, dokumen, dan byte attachment. Reload browser tidak menjadi mekanisme penyimpanan.
- **Worker:** menjalankan proses asynchronous/terjadwal. Memerlukan Redis dan database yang sama dengan API. Menyalakan frontend/API saja tidak menjalankan pekerjaan otomatis worker.
- **GitHub OAuth:** login mengikat akun ke identitas GitHub dan email terverifikasi; undangan serta state OAuth diperiksa untuk mencegah replay.
- **GitHub App:** integrasi repository/webhook terpisah dari OAuth login. Login GitHub berhasil tidak berarti App/webhook sudah dikonfigurasi.
- **Histori dan notifikasi:** perubahan tertentu menghasilkan aktivitas/histori dan notifikasi bagi penerima yang masih berhak mengakses. Pengecekan akses dilakukan lagi saat data dibaca.

Komentar, attachment, dan activity issue diperbarui melalui polling foreground sekitar **5 detik**. Inbox melakukan polling sekitar **15 detik** saat aktif. Ini **bukan realtime push** atau editor kolaboratif multi-cursor, dan bukan jaminan waktu pengiriman notifikasi.

## 9. Kendala umum dan solusinya

| Gejala | Hal yang perlu diperiksa |
|---|---|
| Login meminta undangan | Akun GitHub belum memiliki membership aktif; gunakan tautan undangan yang valid. |
| Email undangan tidak cocok | Pastikan email yang dituju terverifikasi pada akun GitHub yang dipakai login. |
| Undangan kedaluwarsa/dicabut/sudah dipakai | Minta owner/admin menerbitkan undangan baru. |
| Bisa melihat tim tetapi tidak bisa mengedit issue | Public read access bukan write access; bergabung ke tim dan periksa apakah role Anda viewer atau workspace read-only. |
| Owner/admin tidak melihat tim private | Harus ditambahkan oleh pengelola yang sudah memiliki akses; tidak ada bypass otomatis. |
| Project atau issue tampil “not found” | Data mungkin tidak ada atau tidak dapat diakses. Respons ini sengaja tidak membocorkan keberadaan data private. |
| Tidak menerima notifikasi | Periksa subscription, kategori preference, dan akses saat ini. Aktor tidak menerima notifikasi dari tindakannya sendiri. |
| PR/branch tidak berubah di REKA | Periksa konfigurasi GitHub App, repository mapping, webhook, Redis, dan worker; jangan menyimpulkan dari login OAuth saja. |
| Recurring issue/cycle otomatis tidak muncul | Pastikan jadwal aktif, timezone benar, worker berjalan, dan tidak ada conflict/overlap. |
| Grafik kosong atau metrik durasi tidak tersedia | Histori/snapshot belum cukup. Bukan indikasi bahwa semua pekerjaan bernilai nol. |
| Upload ditolak | Periksa format, isi file, batas 5 MiB, dan izin tulis issue. |
| Attachment lama gagal diunduh | Row lama bisa tidak memiliki byte file; unggah ulang sumber file. |
| Owner/lead terakhir tidak dapat dihapus | Lakukan handoff yang valid terlebih dahulu. |
| `ECONNREFUSED` pada proxy lokal | Pastikan API berjalan pada port yang menjadi target Vite, biasanya 3000. |
| Login/API gagal karena tabel tidak ada | Schema database belum sesuai build. Operator perlu memeriksa migrasi; jangan menjalankan migrasi database existing tanpa approval dan backup. |

Jika menerima error penyimpanan, baca pesan validasi dan coba ulang setelah penyebab diperbaiki. Jangan menutup form dengan asumsi data sudah tersimpan atau menganggap semua perubahan bulk berhasil.

## 10. Batasan dan referensi

- Satu workspace internal; tidak ada portal client eksternal, intake publik, public sharing, billing, atau paket SaaS.
- Tidak ada email delivery, push eksternal, editor multi-cursor, atau klaim bahwa semua perubahan tersinkronkan seketika.
- GitHub Checks/CI ingestion belum didukung; **CI status not reported** bukan bukti CI sukses.
- Angka progress/laporan tunduk pada akses pengguna dan kelengkapan histori. Data private tidak ikut dibocorkan lewat aggregate, search, favorites, atau Inbox.
- Dukungan workflow tidak berarti perilaku provider eksternal telah diverifikasi live. Pengujian terkontrol bukan bukti delivery GitHub nyata.
- Database yang dikonfigurasi telah dimigrasikan melalui 0027 pada 14 Oktober 2026 dengan persetujuan eksplisit dan pemeriksaan integritas. Ini bukan izin untuk migrasi berikutnya atau deployment. Catatan migrasi lama di dokumen teknis menggambarkan kondisi sebelum persetujuan tersebut.

### Referensi teknis

- [Issues dan triage](ISSUES_WORKFLOWS.md)
- [Workspace dan permissions](WORKSPACE_ACCESS.md)
- [Saved views, favorites, dan search](VIEWS_SEARCH.md)
- [Projects dan documents](PROJECTS_DOCUMENTS.md)
- [Initiatives dan roadmap](INITIATIVES_ROADMAP.md)
- [Cycles](CYCLES.md)
- [Kolaborasi dan attachments](COLLABORATION.md)
- [Integrasi GitHub](GITHUB_INTEGRATION.md)
- [Insights](INSIGHTS.md)
- [Catatan migrasi database 14 Oktober 2026](DATABASE_MIGRATION_2026-10-14.md)
- [Panduan deployment untuk operator](../DEPLOYMENT.md)

**Prinsip utama:** catat pekerjaan sebagai issue, tentukan tanggung jawab dengan jelas, perbarui kondisi berdasarkan hasil nyata, dan jangan menganggap role administratif otomatis memberikan akses ke pekerjaan private.
