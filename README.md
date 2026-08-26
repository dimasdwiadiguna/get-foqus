# FOQUS

Aplikasi GTD “Todo → Agenda”. Mobile-first PWA, dideploy di Vercel.

Sebuah todo hidup ketika ia punya slot waktu. FOQUS menjembatani backlog dan kalender —
menghormati jam kerja, waktu sholat, dan buffer perpindahan — lalu memulihkan rencana dalam
hitungan detik ketika hari meleset.

Spesifikasi lengkap ada di [`BRIEF.md`](./BRIEF.md). Rencana eksekusi per milestone ada di
[`PLAN.md`](./PLAN.md). Keputusan teknis yang diambil selama eksekusi tercatat di
[`DECISIONS.md`](./DECISIONS.md).

---

## Struktur

```
apps/
  web/                       React 18 + TypeScript + Vite + Tailwind + vite-plugin-pwa
    api/[[...route]].ts      seluruh API dalam satu Vercel Function (Hono via hono/vercel)
    api/cron/drain-outbox.ts endpoint drain terproteksi CRON_SECRET (belum dijadwalkan, §12)
packages/
  core/                      domain murni: tipe, aturan, waktu, sholat, scheduling engine
  db/                        skema Drizzle + migrasi + seed
  shared/                    Zod schema + tipe DTO yang dipakai bersama web & api
```

Seluruh aturan domain hidup di `packages/core` sebagai fungsi murni yang teruji. UI dan API
hanya memanggilnya — tidak ada logika penjadwalan yang tersebar di komponen React atau route
handler.

---

## Prasyarat

- Node.js ≥ 20
- pnpm ≥ 10
- Akun Neon (atau Vercel Postgres)
- Google Cloud project dengan Calendar API aktif

---

## Menjalankan secara lokal

```bash
pnpm install
cp .env.example .env      # lalu isi seluruh nilainya (lihat dua bagian berikut)
pnpm db:migrate           # jalankan sekali, dari mesin lokal
pnpm dev                  # http://localhost:5173
```

`pnpm dev` hanya menjalankan frontend. Untuk menjalankan API sekaligus (dan karena itulah
satu-satunya cara menguji login), pakai Vercel CLI dari `apps/web`:

```bash
npm i -g vercel
cd apps/web && vercel dev  # http://localhost:3000
```

Perintah lain:

| Perintah                          | Fungsi                                               |
| --------------------------------- | ---------------------------------------------------- |
| `pnpm test`                       | Vitest, terutama `packages/core`                     |
| `pnpm typecheck`                  | TypeScript untuk seluruh workspace                   |
| `pnpm build`                      | build produksi                                       |
| `pnpm db:generate`                | buat migrasi baru dari perubahan skema               |
| `pnpm db:migrate`                 | terapkan migrasi (manual, dari lokal)                |
| `pnpm db:seed <email>`            | seed ulang data contoh untuk pengguna yang sudah ada |
| `node scripts/generate-icons.mjs` | regenerasi ikon PWA dari palet                       |

---

## Setup Google Cloud OAuth dari nol

1. Buka <https://console.cloud.google.com/> → **Select a project** → **New Project**.
   Beri nama, misalnya `foqus`.
2. **APIs & Services → Library** → cari **Google Calendar API** → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** (kecuali kamu memakai Google Workspace dan ingin Internal).
   - Isi App name (`FOQUS`), User support email, dan Developer contact email.
   - **Scopes** → _Add or remove scopes_ → tambahkan:
     - `openid`
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/calendar.readonly`
   - **Test users** → tambahkan alamat Gmail-mu. Selama app berstatus _Testing_, hanya test
     user yang bisa login — itu sudah cukup untuk aplikasi satu pengguna, jadi tidak perlu
     mengajukan verifikasi.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized redirect URIs** → tambahkan **persis satu**:
     `https://<domain-produksi>/api/auth/google/callback`
   - Salin **Client ID** dan **Client secret** ke `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`,
     dan URI di atas ke `GOOGLE_REDIRECT_URI`.

### Jebakan Vercel: redirect URI dan preview deployment

Setiap preview deployment Vercel punya URL berbeda (`foqus-git-abc123-....vercel.app`),
sedangkan Google **menolak** redirect URI yang tidak terdaftar. Mendaftarkan URL preview satu
per satu tidak mungkin dipelihara.

Karena itu FOQUS memakai **satu redirect URI tetap di domain produksi**. Konsekuensinya:

- **Uji login hanya di produksi**, atau lewat satu domain preview tetap yang di-alias
  (`vercel alias set <deployment> preview.foqus.example.com`) dan didaftarkan sebagai redirect
  URI kedua.
- Untuk lokal, tambahkan `http://localhost:3000/api/auth/google/callback` sebagai redirect URI
  tambahan dan set `GOOGLE_REDIRECT_URI` serta `APP_URL` ke `http://localhost:3000` di `.env`.

### Menghasilkan rahasia

```bash
openssl rand -base64 48   # SESSION_SECRET
openssl rand -base64 32   # TOKEN_ENC_KEY — wajib tepat 32 byte
openssl rand -base64 32   # CRON_SECRET
```

Refresh token Google dienkripsi AES-GCM dengan `TOKEN_ENC_KEY` sebelum disimpan, dan **tidak
pernah** dikirim ke browser. Mengganti kunci ini membuat token tersimpan tidak terbaca —
pengguna harus menghubungkan ulang akun Google-nya.

---

## Setup Neon

1. Buat akun di <https://neon.tech> → **New Project**. Pilih region terdekat
   (`ap-southeast-1` untuk Indonesia).
2. Di dashboard project, buka **Connection Details** dan salin **Pooled connection** string
   (host-nya mengandung `-pooler`). Isi ke `DATABASE_URL`.
3. Jalankan migrasi dari mesin lokal:

   ```bash
   pnpm db:migrate
   ```

Migrasi **tidak pernah** dijalankan saat build. Sebuah deploy tidak boleh bisa gagal karena
migrasi — itulah alasan `drizzle-kit` dipanggil manual.

Data contoh (kategori, tag, beberapa task) beserta setelan default — jam tersedia, setelan
sholat Bandung, pomodoro — dibuat otomatis saat pertama kali login lewat Google. Untuk
menyeed ulang: `pnpm db:seed <email>`.

---

## Deploy ke Vercel

Satu Vercel project:

| Pengaturan       | Nilai                                      |
| ---------------- | ------------------------------------------ |
| Root Directory   | `apps/web`                                 |
| Framework Preset | Vite                                       |
| Install Command  | `pnpm install` (dijalankan dari root repo) |
| Build Command    | `vite build`                               |
| Output Directory | `dist`                                     |

Nilai-nilai itu sudah tertulis di `apps/web/vercel.json`, jadi normalnya tidak perlu diisi
manual. Dua hal yang **harus** dicek di Project Settings:

- **Root Directory → “Include files outside of the Root Directory in the Build Step”** wajib
  aktif. Fungsi API memuat `packages/*/dist`, yang berada di luar `apps/web`.
- **Deployment Protection → Vercel Authentication.** Kalau aktif, seluruh request ke deployment
  (termasuk `/api/*`) dialihkan ke `vercel.com/sso-api` dan diblokir CORS. Matikan, atau uji
  hanya lewat domain produksi tempat kamu sudah login.

Daftarkan seluruh variabel di `.env.example` pada Project Settings → Environment Variables.
Folder `apps/web/api/` otomatis menjadi serverless functions; tidak ada server terpisah.

### Paket workspace harus dibangun sebelum fungsi API

`packages/core`, `packages/shared`, dan `packages/db` mengekspor `dist/` hasil kompilasi, bukan
TypeScript mentah. Runtime fungsi Vercel adalah **Node polos** dan tidak bisa memuat `.ts` —
kalau `dist/` belum ada, fungsi crash saat import dan Vercel menjawab
`FUNCTION_INVOCATION_FAILED` (“A server error has occurred”) sebelum satu baris kode FOQUS
berjalan. Karena itu Build Command menjalankan `build:packages` lebih dulu.

Vite dan Vitest tetap membaca paket-paket itu dari sumber lewat alias, jadi mengedit domain
layer tetap hot-reload tanpa build.

**Sebelum setiap deploy, jalankan `pnpm verify:api`.** Perintah itu mem-boot fungsi persis
seperti Vercel dan memanggil rute-rutenya. `pnpm test`, `pnpm typecheck`, dan `pnpm build`
tidak akan pernah menangkap kelas kegagalan ini — ketiganya men-transpile TypeScript sendiri.

**Tidak ada Vercel Cron di v1.** `vercel.json` sengaja tidak punya blok `crons`. Paket Hobby
membatasi cron maksimal sekali sehari — ekspresi yang lebih sering **menggagalkan deploy**
dengan `Hobby accounts are limited to daily cron jobs`, bukan diturunkan diam-diam. Cron harian
tidak memberi nilai untuk FOQUS: agenda hanya lahir saat aplikasi dibuka, jadi jalur
`waitUntil` + `POST /api/sync/drain` saat app dibuka/kembali online sudah menutup seluruh
skenario nyata.

`GET /api/cron/drain-outbox` tetap dibangun dan dilindungi `CRON_SECRET`, supaya penjadwal
eksternal (cron-job.org, GitHub Actions schedule) atau Vercel Cron di paket Pro bisa dipasang
belakangan **tanpa perubahan kode** — cukup daftarkan URL-nya dengan header
`Authorization: Bearer $CRON_SECRET`.

Batas paket Hobby yang membentuk desain: **durasi function 10 detik**. Karena itu setiap
pemrosesan outbox dibatasi 5 entri per request dan klien memanggil `drain` berulang sampai
`remaining === 0`.

---

## Keterbatasan yang perlu diketahui

### Notifikasi pomodoro di iOS

FOQUS **tidak** mengirim notifikasi atau reminder agenda — itu tugas Google Calendar (D11).
Satu-satunya notifikasi aplikasi adalah penanda akhir sesi pomodoro, dan di iOS ia punya batas
nyata:

- Notifikasi web hanya bekerja bila FOQUS **dipasang ke Home Screen** (iOS 16.4+). Di tab
  Safari biasa, `Notification.requestPermission()` tidak tersedia.
- iOS mematikan service worker dan mem-_throttle_ timer saat app di-background. Karena itu
  timer pomodoro **berbasis timestamp**, bukan hitung mundur di memori: sisa waktu selalu
  dihitung ulang dari `startedAt`.
- `setTimeout` untuk notifikasi bisa tidak pernah berjalan bila app di-background terlalu lama.
  FOQUS memasang jaring pengaman: setiap `visibilitychange`/app resume, bila
  `startedAt + plannedSec < now` dan sesi belum ditutup, layar penyelesaian langsung muncul.
  Inilah yang membuat fitur terasa andal meski notifikasinya sendiri tidak sampai.
- Suara _ticking_ hanya berjalan saat dokumen terlihat. Memaksa audio berjalan di background
  akan dimatikan iOS dan justru terasa rusak.

### Offline

Di v1, saat offline FOQUS bisa: melihat data, menandai task selesai, mencatat realisasi agenda,
dan menjalankan pomodoro. Membuat/mengedit/menjadwalkan butuh koneksi — kontrolnya dinonaktifkan
dengan penjelasan di tempat, bukan toast error setelah ditekan.

### Membaca kegagalan API di produksi

Bahasa pesan errornya yang membedakan:

| Yang tampil                                                                          | Artinya                                                                                | Langkah                                                                      |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| “Fungsi server gagal dijalankan. Periksa log Vercel.” (`FUNCTION_INVOCATION_FAILED`) | Fungsi crash saat import; kode FOQUS tidak pernah jalan                                | `pnpm verify:api`, lalu cek Build Command sudah menjalankan `build:packages` |
| “Terjadi kesalahan di server. Coba lagi.”                                            | Fungsi jalan, ada yang gagal di dalamnya — biasanya env kurang atau DB belum dimigrasi | Cek log function di Vercel; pesan aslinya dicatat di sana                    |
| “Sesi berakhir. Silakan masuk lagi.”                                                 | Normal — belum login                                                                   | Masuk lewat Google                                                           |

Layar error menampilkan `HTTP <status> · <code>` di bawah pesannya untuk mempercepat ini.

### Sinkronisasi Google Calendar

Satu arah: FOQUS → Google Calendar. Kalender dibaca **hanya** lewat FreeBusy untuk deteksi
bentrok. Tidak ada impor event GCal menjadi task atau agenda.

Agenda ditulis ke kalender terpisah bernama **“FOQUS — Agenda”** yang dibuat otomatis — aman
untuk di-hide atau dihapus, dan tidak mencemari kalender pribadi. Buffer adalah konsep internal
dan tidak dikirim ke Google Calendar; event GCal hanya mencakup `[startAt, endAt]`.

---

## Status milestone

|     | Milestone                                                     | Status     |
| --- | ------------------------------------------------------------- | ---------- |
| M0  | Fondasi — monorepo, skema penuh, PWA shell, login Google      | ✅ selesai |
| M1  | Task — CRUD, kategori, tag, sub-task, dependency, Hari Ini    | belum      |
| M2  | Agenda & kalender — slot usulan, mode bawa, override spesifik | belum      |
| M3  | Google Calendar — outbox, drain, FreeBusy                     | belum      |
| M4  | Pomodoro — layar fokus, timer timestamp, wake lock            | belum      |
| M5  | Offline — service worker, tiga mutasi luring, outbox klien    | belum      |
| M6  | Time block & smart allocation — `allocate()` + test           | belum      |
| M7  | Peninjauan & perayaan                                         | belum      |
