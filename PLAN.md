# PLAN.md — FOQUS

Rencana eksekusi per milestone. Disusun dari `BRIEF.md`; keputusan yang diambil sendiri
selama eksekusi dicatat di `DECISIONS.md`.

---

## Prinsip yang mengikat seluruh rencana

1. **`packages/core` adalah jantungnya.** Semua aturan domain berupa fungsi murni, deterministik,
   tanpa I/O. Test ditulis lebih dulu untuk setiap invariant §5.
2. **Skema data lengkap sejak M0** (D3). Tidak ada migrasi struktural besar di milestone berikutnya —
   milestone selanjutnya hanya mengisi tabel yang sudah ada.
3. **Tidak ada asumsi filesystem persisten / state antar-request / worker jangka panjang** (D13).
4. **Tap-first** (D14). Setiap alur harus selesai dengan ketukan; drag hanya akselerasi intra-layar.
5. Bahasa antarmuka Indonesia; identifier, komentar, nama file dalam Bahasa Inggris.

---

## Struktur repositori target

```
pnpm-workspace.yaml
tsconfig.base.json
vercel.json
.env.example
packages/
  core/     domain murni: tipe, aturan, waktu, sholat, scheduling engine   (zero dep runtime)
  shared/   Zod schema + DTO yang dipakai bersama web & api
  db/       skema Drizzle + migrasi + seed
apps/
  web/
    api/[[...route]].ts        seluruh API (Hono via hono/vercel)
    api/cron/drain-outbox.ts   endpoint drain terproteksi CRON_SECRET
    src/                       React 18 + Vite + Tailwind + vite-plugin-pwa
```

Deployment: satu Vercel project, Root Directory `apps/web`, install dari root repo.

---

## M0 — Fondasi

**Tujuan:** kerangka yang bisa di-deploy hari pertama, dengan skema penuh dan login Google.

1. **Monorepo & tooling** — pnpm workspaces, TypeScript strict, Vitest, ESLint/Prettier ringan,
   `tsconfig.base.json` dengan path alias `@foqus/*`.
2. **`packages/core` (kerangka penuh, isi bertahap)**
   - Tipe domain lengkap §4 (Task, Category, Tag, Dependency, Agenda, Pomodoro,
     AvailabilityWindow, TimeBlock, PrayerSettings, WeeklyPlan, AllocationDraft, Settings).
   - `id/uuidv7.ts` — generator UUIDv7 murni (klien membuat ID sendiri, §4).
   - `time/` — interval aritmetika (merge, subtract, overlap), konversi zona waktu pengguna,
     batas hari lokal. Ini fondasi seluruh mesin penjadwalan.
   - `prayer/` — turunan blok sholat harian dari `PrayerSettings` (adhan-js), default Bandung.
   - `rules/` — deteksi siklus dependency (DFS), evaluasi pelanggaran constraint (violations)
     dengan pesan spesifik berbahasa Indonesia (§5.5).
   - `scheduling/allocate.ts` — tanda tangan fungsi + kerangka; implementasi penuh di M6.
   - Test Vitest untuk seluruh yang di atas.
3. **`packages/db`** — skema Drizzle **lengkap untuk full spec** (semua tabel §4, soft delete,
   `user_id`, timestamptz), `drizzle.config.ts`, migrasi SQL pertama, script `db:push`/`db:migrate`/`db:seed`.
4. **`packages/shared`** — Zod schema untuk seluruh DTO API + tipe hasil `infer`.
5. **API (`apps/web/api/[[...route]].ts`)**
   - Hono + `hono/vercel`, route `/api/health`.
   - OAuth Google: `/api/auth/google/start`, `/api/auth/google/callback`, `/api/auth/me`, `/api/auth/logout`.
   - Refresh token dienkripsi AES-GCM (`TOKEN_ENC_KEY`) sebelum masuk Postgres; tidak pernah ke klien.
   - Session cookie httpOnly JWT (`SESSION_SECRET`), `Secure`, `SameSite=Lax`.
   - `/api/bootstrap` — mengembalikan seluruh read model milik pengguna untuk mengisi mirror Dexie.
   - `/api/cron/drain-outbox` — kerangka terproteksi `CRON_SECRET` (implementasi push di M3).
6. **Klien** — shell PWA: empat tab bawah (Hari Ini · Tugas · Kalender · Setelan), token desain §11
   (palet, tiga typeface, wordmark FOQUS dengan ekor Q), manifest + ikon, `vite-plugin-pwa`,
   Dexie mirror + TanStack Query dengan Dexie persister, layar login.
7. **Deploy** — `vercel.json`, `.env.example` lengkap, README setup Google Cloud OAuth dari nol,
   setup Neon, cara migrasi, catatan keterbatasan notifikasi iOS.

**DoD:** login berhasil di URL produksi · data seed tampil di Hari Ini/Tugas · FOQUS terpasang
sebagai PWA di ponsel · `pnpm test` hijau · `pnpm build` hijau.

---

## M1 — Task

CRUD task + kategori + tag + prioritas + due date; sub-task (maks 3 level); dependency dengan
deteksi siklus; stepper alokasi pomodoro; filter cepat; swipe kanan/kiri (§10.4) dengan alternatif
ketukan penuh; mode seleksi; layar Hari Ini versi awal (tanpa pita hari).

**DoD:** seluruh atribut task dapat dikelola dari ponsel tanpa keyboard eksternal.

---

## M2 — Agenda & kalender

Availability window + buffer + blok sholat (derived); tampilan Hari (pita hari §11) & Pekan;
**Jalur A slot usulan** dan **Jalur B mode bawa** (§10.2); pindah/ubah durasi blok agenda
(dnd-kit, intra-layar); hapus agenda tanpa menyentuh task; dialog override yang menyebut
pelanggaran spesifik (§5.5).

**DoD:** invariant §5.1–§5.6 punya test dan lulus; seluruh alur penjadwalan lulus uji Playwright
**dengan klik saja, tanpa satu pun gerakan drag**.

---

## M3 — Google Calendar

Pembuatan kalender "FOQUS — Agenda"; `SyncOutbox` di Postgres; jalur `waitUntil` + `POST /api/sync/drain`
(maks 5 entri per request, klien memanggil berulang sampai `remaining === 0`); push create/update/delete
dengan `extendedProperties.private.foqusAgendaId` sebagai kunci idempotensi; FreeBusy read + cache +
tampilan bentrok; indikator status sync + tombol "Coba lagi".

**DoD:** agenda muncul di GCal < 10 detik; hapus agenda menghapus event; putus koneksi di tengah
proses lalu buka app → outbox terkuras bersih.

---

## M4 — Pomodoro

Layar fokus; timer berbasis timestamp (D9); Wake Lock; ticking Web Audio (hanya saat dokumen
terlihat); bell + Notification; rekonsiliasi saat `visibilitychange`; log sesi append-only;
simbol ○/●/⬤ di agenda dan task.

**DoD:** mulai sesi → kunci layar 26 menit → buka app → sesi tercatat benar tanpa drift.

---

## M5 — Offline

Service worker Workbox (precache shell, `NetworkFirst` untuk API GET); read offline penuh dari Dexie;
tiga mutasi offline (§8) lewat outbox klien + retry; `POST /api/sync/push`; indikator koneksi +
jumlah item tertunda; penonaktifan kontrol yang butuh online **dengan penjelasan di tempat**,
bukan toast error setelah ditekan.

**DoD:** mode pesawat: buka app, lihat hari ini, centang selesai, jalankan pomodoro; online kembali → tersinkron.

---

## M6 — Time block & smart allocation

Time block one-time & recurring (RRULE) dengan filter; perencanaan pekanan; implementasi penuh
`allocate()` (greedy + skoring, §6) beserta `reason` berbahasa Indonesia per item; review draft
(terima/tolak/geser); Commit sekali jalan.

**DoD:** mesin tidak pernah melanggar §5.4 di seluruh test; tiap item draft punya alasan.

---

## M7 — Peninjauan & perayaan

Prompt realisasi otomatis saat app dibuka (D7); tunda/jadwal ulang cepat; centang yang menggambar
dirinya; cincin progres pekanan; confetti untuk tiga momen saja; mode gelap; polesan aksesibilitas
(fokus keyboard, kontras AA, area aman iOS).

**DoD:** meninjau 5 agenda lewat selesai dalam < 20 detik dengan satu ibu jari.

---

## Catatan penyimpangan dari brief

Tidak ada penyimpangan dari arah desain §11 maupun stack §3 yang direncanakan.
Keputusan kecil yang diambil sendiri selama eksekusi dicatat di `DECISIONS.md` (§15).
