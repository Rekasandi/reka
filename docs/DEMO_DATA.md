# Data demo REKA

Data ini telah diisi pada **14 Oktober 2026**, di workspace existing pada database aplikasi saat ini (Neon branch `production`), atas persetujuan pengguna. Ini bukan deployment atau integrasi provider sungguhan.

Semua nama konten demo diberi penanda **`[DEMO]`**. Team keys: **DENG**, **DDES**, **DOPS**. Email fiktif menggunakan `example.test`; tidak ada email yang dikirim.

## Mulai dari mana?

1. Refresh aplikasi dan login sebagai owner yang meminta pengisian demo.
2. Buka **Documents → [DEMO] Mulai di sini — alur demo REKA**.
3. Buka **My Issues** untuk issue yang ditugaskan kepada Anda: status, priority, estimate, due date, labels, dan cycle sudah bervariasi.
4. Buka **Projects → [DEMO] Website Toko Nusantara**. Coba tab **Issues**, **Milestones**, **Dependencies**, **Updates**, dan **Documents**. Issue validasi checkout memiliki komentar dan attachment untuk diunduh.
5. Buka **Triage** untuk tiga laporan yang masih menunggu keputusan. Keputusan accept, decline, dan duplicate juga sudah dicontohkan pada issue lain beserta activity-nya.
6. Buka **Cycles**. Ada satu cycle selesai, tiga cycle aktif, dan satu cycle berikutnya. Cycle selesai mempunyai final snapshot; cycle aktif mempunyai masing-masing satu snapshot hasil pengukuran aktual.
7. Buka **Initiatives** dan **Roadmap** untuk hubungan tujuan → project → issue. Project Design System sengaja belum dijadwalkan.
8. Buka **Views** melalui menu issues: Prioritas tinggi, Pekerjaan saya, dan Board Engineering. **Favorites** berisi issue, project, view, serta panduan demo.
9. Buka **Inbox** untuk lima notifikasi simulasi, empat belum dibaca dan satu sudah dibaca saat seed. Semua menjelaskan bahwa ini bukan aktivitas anggota/provider sungguhan.
10. Buka **Insights**, gunakan tanggal hari pengisian dan timezone **Asia/Jakarta**. Ada **sembilan completion event aktual** di tim demo.

Panduan umum workflow dan permission: [PANDUAN_REKA.md](PANDUAN_REKA.md).

## Isi skenario

| Konten | Jumlah dan contoh |
| --- | --- |
| Teams | 3: Engineering, Design, Operations Private |
| Clients | 4: Nusantara Retail, Lintas Logistik, Sehat Bersama, Aruna Finance |
| Projects | 6, terhubung ke client; status planned/in progress/paused/completed dan health on track/at risk/off track |
| Issues | **36 total**: 30 issue project + 6 submission intake; termasuk satu sub-issue, satu arsip, dan relasi blocked by |
| Labels | 9, scoped pada masing-masing tim |
| Milestones | 12, masing-masing project memiliki dua milestone dengan issue assignment |
| Cycles | 5; capacity, estimates termasuk contoh estimate kosong dan nol |
| Initiatives | 3, termasuk tujuan lintas tim dan tujuan selesai |
| Documents | 11: 6 spesifikasi project, 3 panduan tim, 1 panduan workspace, 1 dokumen arsip |
| Collaboration | 12 komentar, 6 relasi issue, 6 subscriptions, 2 attachment teks/Markdown, 6 project updates, 2 project dependencies |
| Intake templates | 3 dengan field reproduksi dan dampak yang wajib diisi |
| Saved views / favorites | 3 views, 4 favorites pada akun owner peminta |
| Users | 5 profil **pending/inactive**, dengan role admin/member/guest/client; bukan akun GitHub terverifikasi |
| Invitations | 2 email fiktif: satu pending, satu revoked; token tidak ditulis ke dokumentasi/manifest |
| Inbox | 5 notifikasi simulasi, hanya untuk owner peminta |
| Recurrence | 1 contoh konfigurasi **stopped**, agar tidak membuat issue otomatis setelah pengisian |

DOPS adalah tim private. Owner pembuat telah menjadi anggota dan lead secara eksplisit; owner/admin lain tidak otomatis mendapat akses tanpa membership. Profil dummy pending tidak digunakan sebagai assignee aktif atau aktor palsu. Di halaman Users, owner/admin dapat melihat profil tersebut pada filter **All**.

## Batasan yang disengaja

- GitHub settings, repository, branch, PR, installation, webhook, dan credentials existing **tidak diubah**. Tab Repositories tetap menunjukkan data nyata atau empty state; tidak dibuat sinkronisasi GitHub palsu.
- Tidak ada login baru untuk pengguna dummy, pengiriman email, deployment, perubahan role pengguna existing, atau perubahan konfigurasi workspace existing.
- Pekerjaan demo ditugaskan pada owner yang meminta pengisian, bukan akun fiktif yang berpura-pura sudah admitted.
- Tanggal rencana project/cycle dan due date bersifat contoh. **Creation time, komentar, activity, histori status, completion event, dan snapshot tidak dibackdate.** Lead/cycle time mencerminkan transisi singkat saat seed, bukan delivery historis.
- Burndown aktif baru memiliki satu titik aktual; bukan grafik historis hasil fabrikasi. Velocity hanya menggunakan final snapshot cycle yang benar-benar ditutup saat seed.
- Auto-create cycle hanya dinonaktifkan pada **tiga tim demo baru**. Pengaturan tim existing tidak disentuh.

## Keamanan dan bukti

- Backup sebelum pengisian: `reka-before-demo-20261014`, ID `br-misty-pine-b3dvhviv`, tanpa compute, kedaluwarsa **2026-10-21T11:59:05Z**. Jangan restore tanpa persetujuan terpisah; restore akan menghilangkan perubahan setelah backup.
- Fingerprint sebelum/sesudah membuktikan **setiap row existing pada 47 tabel tetap identik**. Penambahan data demo tidak menghapus atau mengubah data asli.
- Mayoritas data dibuat melalui API dengan authorization owner. Hanya asosiasi project/client (belum memiliki API write field), snapshot aktif yang diukur dari issue aktual, dan Inbox simulasi menggunakan SQL langsung, terbatas pada record demo.
- Session sementara untuk seed/verifikasi telah dihapus; session pengguna existing tidak diubah.
- Tes terisolasi: `apps/api/test/demo-seed.integration.test.cjs` lulus, termasuk rerun tanpa duplikasi, persist/reopen database, perlindungan data asli, pending identities, histori tanpa backdate, dan tanpa record provider GitHub.
- Verifikasi browser menggunakan API/database aplikasi nyata: 21 halaman/detail lulus, termasuk milestone, private team, dokumen, Inbox, dan Insights; tidak ada HTTP API 5xx atau exception aplikasi. Desktop/mobile juga diperiksa.

## Script dan manifest lokal

Script: `scripts/seed-demo.mjs`.

```sh
# Hanya setelah ada persetujuan write untuk database target.
# Ini bukan perintah yang dijalankan otomatis ketika dev/build/test.
node scripts/seed-demo.mjs --confirm-configured-database
```

Default owner: `rhezagustam@gmail.com`; database dari `DATABASE_URL` atau `.env`; API lokal `http://127.0.0.1:3000`. Workspace owner dari API harus sesuai dengan database target.

Manifest lokal **`.pi/demo-data-v1.json`** berisi ID record dan langkah yang telah selesai; diabaikan Git. Jangan hapus manifest atau memindahkannya ke database lain lalu menjalankan ulang. Rerun dengan manifest yang sama tidak mereset perubahan manual atau menduplikasi seed yang sudah berhasil. Ini bukan sistem transaksi/rollback lintas seluruh API: jika suatu langkah terputus di tengah, periksa data/manifest sebelum mengulangi.

Untuk membersihkan demo, gunakan ID manifest sebagai daftar sasaran dan minta persetujuan penghapusan terlebih dahulu. Jangan menghapus berdasarkan substring `[DEMO]` saja atau merestore backup sebagai cleanup otomatis.
