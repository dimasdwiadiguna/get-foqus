# BRIEF.md — FOQUS

> Aplikasi GTD "Todo → Agenda", mobile-first PWA, dideploy di Vercel.
>
> Brief ini ditujukan untuk Claude Code. Baca seluruhnya sebelum menulis kode.
> **Langkah pertama: jangan langsung coding.** Buat `PLAN.md` berisi rencana eksekusi
> per milestone, lalu tunggu konfirmasi. Setelah itu kerjakan **satu milestone per sesi**,
> dan berhenti di setiap checkpoint untuk review.

---

## 1. Konteks & tujuan

Pengguna tunggal (owner aplikasi ini) adalah seorang praktisi dengan hari yang sangat dinamis:
rapat mendadak, jadwal geser, banyak konteks berbeda (operasional, mengajar, riset, dakwah).
Sistem todo biasa gagal untuk dia karena **daftar tugas tidak pernah bertemu dengan waktu nyata**.

Tesis produk: **sebuah todo baru "hidup" ketika ia punya slot waktu.** FOQUS adalah
jembatan antara backlog dan kalender, dengan tiga janji:

1. Mengubah todo menjadi **agenda** (todo + slot waktu) dalam satu atau dua ketukan.
2. Menghormati batas dunia nyata: jam kerja, waktu sholat, buffer perpindahan, blok fokus.
3. Ketika hari meleset — dan pasti meleset — **memulihkan rencana dalam hitungan detik**, bukan menit.

Nada produk: tenang, tegas, memberi rasa menang. Bukan aplikasi yang menghakimi ketika target lewat.

**Nama produk: FOQUS** (ditulis kapital semua di seluruh antarmuka, dokumen, dan manifest).
**Bahasa antarmuka: Bahasa Indonesia.** Identifier kode, komentar, dan nama file: Bahasa Inggris.

---

## 2. Decision log (sudah dikunci — jangan diperdebatkan ulang)

| # | Keputusan | Alasan |
|---|---|---|
| D1 | Sinkronisasi Google Calendar **satu arah**: FOQUS → GCal. GCal **dibaca** hanya via FreeBusy untuk deteksi bentrok. | Menghilangkan seluruh kelas bug rekonsiliasi dua arah. |
| D2 | Ada **backend** berupa serverless function di Vercel (bukan murni client-side). Refresh token Google tidak pernah menyentuh browser. | Keamanan token + siap multi-device. |
| D3 | Build **bertahap per milestone**, tapi **skema data & modul domain disiapkan untuk full spec sejak M1**. | Hindari migrasi besar di tengah jalan. |
| D4 | Smart allocation menghasilkan **draft usulan** yang direview, digeser, lalu di-commit. Tidak pernah menulis langsung. | Kepercayaan pengguna. |
| D5 | Dependency yang belum selesai **tidak memblokir** penjadwalan — hanya memunculkan peringatan. | Hari nyata tidak selalu berurutan. |
| D6 | **Constraint & time block bersifat _advisory_ saat alokasi manual** (boleh override dengan konfirmasi), tapi **_binding_ saat smart allocation** (mesin tidak boleh melanggarnya). | Ini pembeda penting — jangan pakai satu jalur validasi untuk keduanya. |
| D7 | Agenda yang lewat tanpa dicek memunculkan **prompt realisasi otomatis saat app dibuka**. | Pemulihan rencana harus terjadi tanpa disiplin ekstra. |
| D8 | Offline: **view + centang selesai + jalankan pomodoro**. Membuat/mengedit/menjadwalkan butuh online di v1. | Ruang lingkup terkendali, konflik minimal. |
| D9 | Pomodoro **berbasis timestamp**, bukan hitung mundur di memori. Notifikasi saat sesi selesai. | Timer JS di-throttle saat background. |
| D10 | Autentikasi **Google saja**, sekaligus meminta scope Calendar. | Satu langkah onboarding. |
| D11 | **Tidak ada notifikasi/reminder agenda dari FOQUS.** Pengingat agenda datang dari Google Calendar. Notifikasi app hanya untuk akhir sesi pomodoro. | Hindari notifikasi ganda. |
| D12 | Agenda ditulis ke **kalender terpisah** milik pengguna (dibuat otomatis, nama: **"FOQUS — Agenda"**), bukan kalender utama. | Aman untuk dihapus/di-hide, tidak mencemari kalender pribadi. |
| D13 | **Deploy di Vercel.** Konsekuensinya: tidak ada filesystem persisten, tidak ada proses worker jangka panjang. Basis data harus berupa Postgres serverless, dan pekerjaan latar dirancang sebagai `waitUntil` + drain yang dipicu klien — **tanpa penjadwal apa pun di v1** (§12). | Ditetapkan oleh pemilik produk. |
| D14 | **Tap-first, bukan drag-first.** Tidak ada drag lintas layar di viewport < 768px. Menjadwalkan task dilakukan lewat slot usulan atau *mode bawa*; drag hanya untuk manipulasi di dalam satu layar. | Ponsel tidak bisa menampilkan daftar task dan kalender secara bersamaan tanpa membuat keduanya tidak terpakai. Juga syarat WCAG 2.2 SC 2.5.7. |

---

## 3. Stack

**Monorepo** (pnpm workspaces):

```
apps/
  web/                 React 18 + TypeScript + Vite + Tailwind + vite-plugin-pwa (Workbox)
    api/[[...route]].ts   Satu Vercel Function berisi seluruh API (Hono via `hono/vercel`)
    api/cron/drain-outbox.ts
packages/
  core/                Domain murni: tipe, aturan, scheduling engine, prayer time.
                       ZERO dependency pada React/DOM/DB. Ini jantung aplikasi.
  db/                  Skema Drizzle + migrasi
  shared/              Zod schema + tipe DTO yang dipakai bersama web & api
```

**Deployment: satu Vercel project**, Root Directory = `apps/web`.
Output Vite (`dist/`) disajikan sebagai static SPA; folder `apps/web/api/` otomatis menjadi
serverless functions. Tidak ada server terpisah, tidak ada Docker.

**Basis data: Postgres serverless (Neon, atau Vercel Postgres).**
Driver: `@neondatabase/serverless` + `drizzle-orm/neon-http`. Migrasi via `drizzle-kit`,
dijalankan manual dari lokal (bukan saat build) supaya deploy tidak pernah gagal karena migrasi.

> **Catatan penting:** SQLite/`better-sqlite3` **tidak boleh dipakai**. Filesystem Vercel bersifat
> ephemeral — data akan hilang setiap deploy dan tidak dibagi antar instance function.

Library kunci:
- **Hono** + `hono/vercel` — seluruh route API dalam satu catch-all function
- **Drizzle ORM** — skema & query, type-safe
- **Dexie** — IndexedDB (mirror read model + outbox lokal)
- **TanStack Query** — cache/refetch, dengan Dexie sebagai persister
- **dnd-kit** — drag & drop **intra-layar saja** (memindah blok agenda, mengurutkan task). Jangan dipakai untuk drag lintas layar di ponsel — lihat D14.
- **adhan** (adhan-js) — waktu sholat, dihitung lokal tanpa jaringan
- **rrule** — time block berulang
- **Zod** — validasi di batas API
- **`@vercel/functions`** — `waitUntil()` untuk pekerjaan pasca-respons
- **canvas-confetti** — momen perayaan
- **Vitest** (unit, terutama `packages/core`) + **Playwright** (alur kritis)

Alasan tidak memakai Next.js: FOQUS terautentikasi penuh, jadi SSR tidak memberi nilai apa pun,
sementara kontrol penuh atas service worker sangat krusial untuk M5. Vite + `vite-plugin-pwa`
memberi kontrol itu, dan tetap berjalan mulus di Vercel sebagai static SPA + functions.

Aturan: **seluruh aturan domain hidup di `packages/core` sebagai fungsi murni yang deterministik dan teruji.**
UI dan API hanya memanggilnya. Tidak boleh ada logika penjadwalan yang tersebar di komponen React
atau di route handler.

---

## 4. Model data

ID: **UUIDv7 dibuat di klien** (agar mutasi offline tidak butuh round-trip). Semua timestamp
disimpan **UTC ISO-8601** (`timestamptz`); render selalu di zona waktu pengguna
(`Asia/Jakarta`, dapat diubah di settings). Semua tabel milik pengguna punya `user_id`,
`created_at`, `updated_at`, `deleted_at` (soft delete).

### 4.1 Task (todo)

```ts
Task {
  id, userId
  parentTaskId?: string        // anak = task setara, punya agenda sendiri
  title, notes?
  categoryId?: string
  priority: 'P1' | 'P2' | 'P3' | 'P4'
  dueDate?: string             // date-only
  allocatedPomodoros: number   // default 1
  status: 'inbox' | 'active' | 'done' | 'archived'
  completedAt?
  sortOrder: number
}
```

- **Parent–child**: hierarki tampilan. Anak adalah task penuh — bisa punya kategori, due date,
  dan agenda sendiri. Menyelesaikan semua anak **tidak** otomatis menyelesaikan induk (tapi
  tampilkan progress "3/5 sub-task selesai" dan tawarkan aksi "Tandai induk selesai").
  Kedalaman maksimum: 3 level.
- **Menghapus task** → soft delete task + semua agenda-nya + hapus event GCal terkait.

### 4.2 Category & Tag

```ts
Category { id, userId, name, colorHex, sortOrder }   // dibuat penuh oleh pengguna
Tag      { id, userId, name }
TaskTag  { taskId, tagId }
```

Tidak ada kategori bawaan selain contoh saat seed pertama (bisa dihapus semua).

### 4.3 Dependency (graf terpisah dari hierarki)

```ts
TaskDependency { taskId, dependsOnTaskId }
```

Cegah siklus saat penulisan (deteksi DFS di `core`). Dependency bersifat **peringatan**, bukan gerbang (D5).

### 4.4 Agenda (todo yang sudah punya slot)

```ts
Agenda {
  id, userId, taskId
  startAt, endAt               // UTC
  bufferAfterMin: number       // default dari settings (10), dapat di-override per agenda
  bufferBeforeMin: number      // default 0 — untuk commuting buffer
  status: 'planned' | 'done' | 'partial' | 'missed' | 'skipped'
  realizationCheckedAt?
  gcalEventId?
  syncState: 'pending' | 'synced' | 'error'
}
```

- **Menghapus agenda tidak menghapus task.** Task kembali ke backlog. Ini invariant wajib —
  tulis test untuk itu.
- **Reserved span** = `[startAt - bufferBefore, endAt + bufferAfter]`. Mesin penjadwalan
  menganggap seluruh reserved span sebagai terpakai. **Buffer tidak dikirim ke Google Calendar** —
  ia konsep internal. Event GCal hanya `[startAt, endAt]`.
- Satu task boleh punya banyak agenda (pekerjaan dipecah lintas hari).

### 4.5 Pomodoro

```ts
PomodoroSession {
  id, userId, taskId, agendaId?
  kind: 'focus' | 'short_break' | 'long_break'
  startedAt, endedAt?
  plannedSec, actualSec
  outcome: 'completed' | 'abandoned'
}
```

Append-only — tidak pernah diedit. Ini membuat sinkronisasi offline bebas konflik.

**Simbol di agenda**: `allocatedPomodoros` dari task → lingkaran kosong ○;
setiap `focus` session dengan `outcome='completed'` → lingkaran terisi ●.
Jika terpakai melebihi alokasi, tampilkan kelebihannya dengan gaya berbeda (⬤ dengan ring),
bukan sebagai kegagalan.

### 4.6 Constraint waktu (availability window)

```ts
AvailabilityWindow { id, userId, dayOfWeek: 0..6, startTime: 'HH:mm', endTime: 'HH:mm' }
```

Seed default:
- Senin–Jumat: `04:00–22:00`
- Sabtu–Minggu: `06:00–20:00`

Dapat diedit dan ditambah (boleh lebih dari satu jendela per hari).

### 4.7 Time block

```ts
TimeBlock {
  id, userId, title, colorHex
  recurrence: null | string    // RRULE; null = sekali
  startAt, endAt               // untuk one-time; untuk recurring: waktu & durasi acuan
  filter: {
    categoryIds?: string[]
    tagIds?: string[]
    taskIds?: string[]
    priorities?: Priority[]
  }
}
```

Semantik: di dalam blok ini, **hanya task yang lolos filter yang boleh dialokasikan** oleh
smart allocation (binding). Saat pengguna drag manual task yang tidak lolos → dialog konfirmasi
override, bukan penolakan (D6).

### 4.8 Blok sholat

```ts
PrayerSettings {
  userId, latitude, longitude, method, ihtiyatiMin
  perPrayer: { fajr: {enabled, durationMin}, dhuhr: {...}, asr, maghrib, isha }
  pushToGoogleCalendar: boolean   // default false
}
PrayerOverride { userId, date, prayer, enabled?, durationMin? }
```

Default (sudah terisi tanpa setup — ini janji produk):
- Koordinat Bandung: `-6.9175, 107.6191`
- Metode: Kemenag RI → Fajr 20°, Isya 18°, ihtiyati +2 menit
- Durasi blok default: 30 menit per waktu sholat, kelimanya aktif

Blok sholat **dihitung lokal setiap hari** (adhan-js) — tidak disimpan sebagai baris agenda,
melainkan diturunkan (derived). Ia diperlakukan sebagai **soft block**: mesin alokasi
menghindarinya, tapi pengguna boleh menaruh agenda di atasnya dengan konfirmasi.

### 4.9 Weekly plan & draft alokasi

```ts
WeeklyPlan     { id, userId, isoWeek: '2026-W35', taskIds: string[] }
AllocationDraft{ id, userId, weeklyPlanId, createdAt, status: 'open'|'committed'|'discarded',
                 items: DraftItem[] }
DraftItem      { taskId, startAt, endAt, reason: string, conflicts: Conflict[], accepted: boolean }
```

### 4.10 Settings & sinkronisasi

```ts
Settings {
  userId, timezone
  defaultBufferAfterMin: 10
  pomodoro: { focusMin: 25, shortBreakMin: 5, longBreakMin: 15, longBreakEvery: 4,
              tickingSound: true, bellSound: true, autoStartBreak: true }
  celebration: 'full' | 'subtle' | 'off'
  allocation: { allowSplit: true, minChunkPomodoros: 1, workdayStartPreference: 'morning'|'even' }
}
GoogleAccount { userId, refreshTokenEncrypted, scopes, agendaCalendarId, busyCalendarIds: string[] }
SyncOutbox    { id, userId, entity, entityId, op: 'create'|'update'|'delete', payload,
                status: 'pending'|'processing'|'done'|'error', attempts, nextAttemptAt, lastError, createdAt }
FreeBusyCache { calendarId, startAt, endAt, fetchedAt }
```

`SyncOutbox` hidup di Postgres (bukan di memori proses) justru karena Vercel tidak menjamin
instance function yang sama akan hidup di request berikutnya.

---

## 5. Aturan domain (invariants — tulis test untuk setiap butir)

1. Menghapus agenda **tidak pernah** menghapus atau mengubah status task-nya.
2. Menghapus task menghapus semua agenda-nya **dan** event GCal terkait.
3. Reserved span (termasuk buffer) tidak boleh tumpang tindih antar agenda **dalam hasil smart allocation**. Untuk alokasi manual, tumpang tindih diizinkan setelah konfirmasi.
4. Smart allocation **tidak boleh pernah** menghasilkan slot yang: di luar availability window, di dalam blok sholat aktif, di dalam time block yang filternya tidak lolos, tumpang tindih agenda lain, atau tumpang tindih busy GCal.
5. Alokasi manual **selalu boleh**, tapi setiap pelanggaran memunculkan dialog yang menyebutkan **pelanggaran apa persisnya** ("Menabrak blok Ashar", "Di luar jam Sabtu 06:00–20:00"). Jangan pakai kalimat generik.
6. Menjadwalkan task yang punya dependency belum selesai → peringatan inline yang menyebutkan nama prasyaratnya, bukan blokir.
7. `PomodoroSession` append-only.
8. Setiap perubahan agenda menghasilkan entri `SyncOutbox` — tidak ada penulisan GCal langsung dari handler UI.
9. Semua perhitungan waktu memakai zona waktu pengguna untuk aturan kalender (batas hari, hari dalam minggu), bukan UTC.

---

## 6. Mesin smart allocation

**Lokasi:** `packages/core/src/scheduling/allocate.ts`. Fungsi murni, deterministik, tanpa I/O, tanpa LLM.

```ts
function allocate(input: {
  tasks: Task[]                 // dari weekly plan
  horizon: { from: ISO, to: ISO }
  windows: AvailabilityWindow[]
  prayerBlocks: Interval[]      // sudah diturunkan untuk rentang horizon
  timeBlocks: ResolvedTimeBlock[]  // RRULE sudah di-expand
  existingAgendas: Agenda[]     // beserta buffer
  externalBusy: Interval[]      // dari GCal FreeBusy
  settings: Settings
  now: ISO
}): DraftItem[]
```

Algoritma (greedy + skoring, bukan solver):

1. **Urutkan topologis** berdasarkan dependency; siklus sudah dicegah di penulisan.
2. **Skor urgensi** tiap task: `dueDate` terdekat > `priority` > ukuran (pomodoro terbanyak lebih dulu, agar potongan besar dapat slot).
3. **Bangun daftar interval bebas** dalam horizon: availability window dikurangi (blok sholat ∪ agenda existing termasuk buffer ∪ busy GCal).
4. **Tentukan durasi task** = `allocatedPomodoros × focusMin` + break di antaranya (`(n-1) × shortBreakMin`), lalu tambahkan `defaultBufferAfterMin` sebagai reservasi.
5. Untuk tiap task, cari slot dengan skor tertinggi:
   - **+besar** jika berada dalam time block yang filternya lolos (ini gunanya time block)
   - **−besar** (diskualifikasi) jika berada dalam time block yang filternya **tidak** lolos
   - **+** jika sebelum `dueDate`; **diskualifikasi** jika setelah `dueDate` (kecuali tidak ada opsi lain — maka tandai konflik `past_due`)
   - **+** jika setelah agenda semua prasyaratnya
   - **+** preferensi waktu (`morning` = lebih awal lebih baik; `even` = sebar merata antar hari)
   - **−** jika membuat hari terlalu padat (>6 jam agenda terjadwal dalam satu hari)
6. Jika task tidak muat utuh dan `allowSplit`, pecah menjadi potongan ≥ `minChunkPomodoros` dan alokasikan berurutan.
7. Task yang tidak dapat slot → kembalikan sebagai `unallocated` dengan **alasan yang bisa dibaca manusia** ("Tidak ada slot 2 jam sebelum Kamis; jendela Rabu penuh").
8. Setiap `DraftItem` wajib membawa `reason` singkat berbahasa Indonesia yang menjelaskan **mengapa slot itu dipilih** — ini yang membuat pengguna percaya dan mau menekan Commit.

Test wajib: hasil identik untuk input identik; tidak pernah melanggar aturan §5.4; skenario "semua slot penuh"; skenario "task lebih besar dari jendela terpanjang".

Catatan Vercel: alokasi dijalankan di klien atau di function dengan durasi < 10 detik. Karena
`allocate()` murni dan berjalan atas data yang sudah ada di Dexie, **jalankan di klien** —
lebih cepat, dan tidak memakan kuota function.

---

## 7. Integrasi Google Calendar

**Scope OAuth:** `openid email profile`, `https://www.googleapis.com/auth/calendar.events`, `https://www.googleapis.com/auth/calendar.readonly`.

**Alur token:** OAuth authorization-code flow di serverless function. Refresh token dienkripsi
(AES-GCM, kunci dari env `TOKEN_ENC_KEY`) dan **tidak pernah** dikirim ke klien. Klien memegang
session cookie httpOnly milik FOQUS sendiri (JWT bertanda tangan, `Secure`, `SameSite=Lax`).

> **Jebakan Vercel:** setiap preview deployment punya URL berbeda, sedangkan Google OAuth menolak
> redirect URI yang tidak terdaftar. Pakai **satu redirect URI tetap** di domain produksi
> (`https://<domain>/api/auth/google/callback`) dan lakukan pengujian login hanya di produksi
> atau lewat domain preview tetap yang di-alias. Tulis ini di README.

**Push (FOQUS → GCal):**
- Saat pertama connect, buat kalender khusus bernama **"FOQUS — Agenda"**, simpan `agendaCalendarId`.
- Setiap agenda = satu event. Simpan `agendaId` di `extendedProperties.private.foqusAgendaId` sebagai kunci idempotensi.
- Summary event: judul task. Description: kategori, tags, jumlah pomodoro, dan tautan balik ke FOQUS.
- **Pemrosesan outbox tanpa worker jangka panjang:**
  1. Setelah mutasi agenda, function menulis outbox lalu **membalas respons segera**, dan mendorong
     ke GCal di dalam `waitUntil()` (`@vercel/functions`). Ini jalur utama — target < 10 detik.
  2. `POST /api/sync/drain` — dipanggil klien saat app dibuka atau saat kembali online, memproses
     entri `pending`/`error` yang `nextAttemptAt <= now`. Ini jaring pengaman utama.
  3. `GET /api/cron/drain-outbox` — endpoint HTTP biasa yang dilindungi `CRON_SECRET`, melakukan
     hal yang sama untuk semua pengguna. **Dibangun, tapi tidak didaftarkan ke Vercel Cron di v1**
     (lihat §12).
- **Batasi setiap pemrosesan maksimal 5 entri outbox per request.** Function di paket Hobby dibatasi
  10 detik, dan pekerjaan di dalam `waitUntil` ikut terhitung. Jangan pernah mencoba menguras
  seluruh antrean dalam satu panggilan; klien memanggil `drain` berulang sampai `remaining === 0`.
- Retry exponential backoff (maks 5 percobaan), lalu `syncState='error'` dengan pesan yang
  ditampilkan di UI beserta tombol "Coba lagi".
- Jika event hilang di sisi GCal (404 saat update), buat ulang.
- Respons `drain` mengembalikan `{ processed, remaining, errors }` agar klien tahu kapan berhenti.

**Read (GCal → FOQUS, hanya untuk bentrok):**
- Endpoint FreeBusy atas `busyCalendarIds` (default: semua kalender pengguna kecuali "FOQUS — Agenda" — hindari menghitung agenda sendiri sebagai bentrok).
- Refresh saat app dibuka dan tiap 15 menit selama online, dipicu dari klien (bukan cron).
- Hasil disimpan di `FreeBusyCache` dan di-mirror ke IndexedDB agar deteksi bentrok tetap jalan sesaat setelah offline.
- **Tidak ada** impor event GCal menjadi task/agenda. Ini bukan two-way sync (D1).

---

## 8. Offline & sinkronisasi

**Service worker** (Workbox via vite-plugin-pwa): precache app shell; `NetworkFirst` untuk API GET;
mutasi tidak lewat SW melainkan lewat outbox aplikasi.

**Mirror lokal (Dexie):** seluruh task, agenda, kategori, tag, settings, time block, sesi pomodoro,
dan cache freebusy. FOQUS selalu membaca dari Dexie (offline-first read), lalu revalidasi.

**Mutasi yang diizinkan offline (D8):**
- Menandai task selesai / batal selesai
- Menandai realisasi agenda (`done` / `partial` / `missed` / `skipped`)
- Menjalankan dan mencatat sesi pomodoro

Ketiganya masuk ke outbox lokal dan dikirim saat online kembali (`POST /api/sync/push`),
diikuti `POST /api/sync/drain` untuk mendorong perubahan terkait ke GCal.

**Mutasi yang butuh online:** membuat/mengedit task, membuat/memindahkan/menghapus agenda,
smart allocation, mengubah settings. Saat offline, kontrol ini **dinonaktifkan dengan penjelasan
langsung di tempat** — misalnya tombol menjadi label "Butuh koneksi untuk menjadwalkan", bukan
toast error setelah ditekan.

**Resolusi konflik:** last-write-wins berdasarkan `updatedAt` untuk status; sesi pomodoro append-only
(tidak pernah konflik). Indikator status koneksi + jumlah item tertunda ada di header, halus dan tidak mengganggu.

---

## 9. Pomodoro

- Default 25 fokus / 5 pendek / 15 panjang setiap 4 sesi. Semua dapat diubah di settings.
- **Berbasis timestamp (D9):** simpan `startedAt`; sisa waktu selalu dihitung dari `Date.now()`.
  Jangan pernah mengandalkan akumulasi `setInterval` — saat app kembali dari background, waktu harus tetap benar.
- **Wake Lock API** saat layar fokus aktif dan tab terlihat.
- **Ticking**: Web Audio API, loop lembut per detik, **hanya saat dokumen terlihat**. Jangan coba
  memaksa audio berjalan di background — iOS akan mematikannya, dan hasilnya justru terasa rusak.
- **Bell + notifikasi** saat sesi selesai: jadwalkan `setTimeout` untuk Notification, **dan** lakukan
  pemeriksaan saat `visibilitychange`/app resume (jika `startedAt + plannedSec < now` dan sesi belum
  ditutup, langsung tampilkan layar penyelesaian). Fallback ini yang membuat fitur terasa andal
  di iOS meski SW sempat dimatikan. Tulis catatan keterbatasan ini di README.
- Layar fokus: judul task, agenda terkait, waktu besar, tombol Jeda / Lewati / Selesai lebih awal,
  dan deret pomodoro (○ / ●). Setelah sesi selesai → animasi singkat, dot terisi, tawarkan break.

---

## 10. Layar & interaksi

### 10.1 Prinsip interaksi & navigasi

**Navigasi: empat tab bawah** — Hari Ini · Tugas · Kalender · Setelan.
Tab bawah, bukan drawer: seluruh navigasi utama harus terjangkau ibu jari.

**Prinsip yang mengikat seluruh bab ini: setiap aksi wajib bisa diselesaikan hanya dengan ketukan.**
Drag adalah percepatan bagi yang menyukainya, bukan syarat. Ini bukan selera — WCAG 2.2 SC 2.5.7
(*Dragging Movements*, Level AA) mewajibkan alternatif satu-pointer untuk setiap gerakan drag.

**Aturan drag:**
- Drag **hanya berlaku di dalam satu layar** — memindahkan blok agenda di kalender, mengubah
  durasinya, atau menyusun ulang urutan task di daftar.
- **Tidak ada drag lintas layar pada viewport < 768px.** Menarik task dari daftar ke kalender
  mengharuskan dua konteks terlihat bersamaan; di layar ponsel itu berarti keduanya sama-sama
  terlalu kecil untuk dipakai. Jangan mencoba mengakalinya dengan bottom sheet yang menyusut saat
  drag dimulai — polanya rapuh (konflik scroll-vs-drag, auto-scroll di balik sheet) dan mahal dibangun.
- Pada viewport ≥ 768px, tata letak dua panel diaktifkan dan drag lintas panel **boleh** ditambahkan
  sebagai progressive enhancement. Bukan bagian dari v1.

### 10.2 Menjadwalkan task (alur inti, pengganti drag lintas layar)

Ada dua jalur. Keduanya berakhir di tempat sama; yang pertama menutup mayoritas kasus.

**Satu sheet untuk satu pertanyaan: "Kapan?"**
Dulu ada dua pemilih waktu yang tampak kembar — "Jadwalkan" (§10.2) dan "Tunda" (§10.4) —
menawarkan chip yang berbunyi sama ("Besok", "Akhir pekan") padahal hasilnya berbeda total: yang
satu memesan waktu, yang lain hanya memindahkan tenggat. Keduanya sekarang satu bottom sheet
berjudul **"Kapan?"**, dengan dua bagian yang sengaja **tidak** boleh terlihat serupa.

**Jalur A — Beri slot (default, satu ketukan).**
Bagian atas sheet: **3–5 slot usulan** yang dihitung untuk task tunggal itu. Tiap baris
menampilkan **jam** dan alasan singkat: "Besok 09:00–10:40 · dalam blok Kerja Dalam, 2 hari
sebelum tenggat". Satu ketukan = agenda terbentuk + animasi konfirmasi. Baris slot dirender
sebagai **kartu terisi**.

Ini yang membuat aplikasi terasa cepat. Sebagian besar waktu pengguna tidak ingin memilih piksel —
ia ingin "besok pagi, urus saja detailnya".

**Atau geser tenggat saja.**
Bagian bawah sheet, di balik pemisah dan judulnya sendiri: chip **tanggal tanpa jam**
(Besok · Akhir pekan · Pekan depan · Pilih tanggal). Chip ini **tidak pernah** membuat agenda —
ia hanya memindahkan `dueDate`. Dirender sebagai **pill garis**, bukan kartu terisi, supaya
bentuknya sendiri sudah membedakan "memesan waktu" dari "menggeser tenggat".

Baris terakhir sheet: **Pilih di kalender**, pintu ke Jalur B.

**Jalur B — Mode bawa (*carry*), untuk kontrol penuh.**
Menekan "Pilih di kalender" memindahkan pengguna ke tab Kalender dengan task **terbawa**:
- Bilah persisten di bawah layar: judul task, jumlah pomodoro, estimasi durasi, tombol **Batal**.
  Bilah ini bertahan saat pengguna berpindah hari atau mengganti mode hari/pekan.
- Kalender langsung **mewarnai slot yang valid** (tint `tea` transparan) dan **meredupkan yang tidak**,
  dengan label alasan pada area redup ("Blok Ashar", "Di luar jam Sabtu", "Blok Kerja Dalam — kategori
  tidak cocok"). Inilah momen paling efektif untuk mengajarkan constraint kepada pengguna.
- Ketuk sebuah slot → **blok bayangan** muncul di situ, sudah berukuran durasi task, dengan pegangan
  atas-bawah. Sekarang drag terjadi **di dalam satu layar** — dan itu justru nyaman di ponsel.
- Ketuk area redup → sheet konfirmasi override yang menyebut pelanggarannya (D6), bukan penolakan.
- Tombol **Simpan** mengunci agenda.

**Mode bawa wajib punya jalan pulang.** Ia membawa `returnTo`: rute **dan** posisi scroll layar
asal. Setelah Simpan — dan juga setelah Batal — pengguna kembali ke tempat ia berangkat, bukan
ditinggal di tab Kalender. Bilah berubah jadi *undo* selama 5 detik **di layar asal itu**, menyebut
hasilnya ("Terjadwal Kamis 09:00 · Urungkan"). Tanpa aturan ini, menjadwalkan satu task memutus
pekerjaan yang sedang berjalan: pengguna berangkat dari backlog yang sedang disisir dan mendarat
di layar lain tanpa cara kembali ke barisnya.

Mode bawa juga dipakai untuk **menjadwal ulang**: dari kartu peninjauan (§10.7) atau dari sheet
"Kapan?", pengguna bisa langsung masuk ke mode bawa membawa agenda yang sudah ada — dengan
`returnTo` yang sama.

### 10.3 Hari Ini

Hari Ini adalah **satu-satunya permukaan yang berbicara tentang hari ini**, dan pemilik tunggal
pita hari. Tidak ada navigasi antar tanggal di sini — itu pekerjaan Kalender (§10.5).

- **Peninjauan** di paling atas jika ada agenda lewat yang belum dicek (§10.7)
- **Pita hari** (§11) — blok agenda hari ini, blok sholat, dan area di luar jam tersedia
- **Berikutnya**: satu kartu besar untuk agenda terdekat, dengan tombol **Mulai fokus**
- **Sisa hari ini**: task yang jatuh tempo **hari ini atau lebih awal** dan belum punya agenda.
  Yang sudah terlambat **wajib** muncul di sini, ditandai tenang ("Terlambat 4 hari", warna
  `ember`) dan diurutkan paling atas. Menyaring persis tanggal hari ini membuat task yang
  tenggatnya meleset menghilang dari satu-satunya layar yang bertugas menangkapnya — kegagalan
  paling mahal untuk hari yang memang sering meleset (§1). Nadanya tetap netral: menyebutkan,
  bukan menghakimi.
- Aksi pada blok agenda: ketuk = detail; tekan-tahan = angkat untuk dipindah di dalam pita hari
  (dengan auto-scroll di tepi, snap 5 menit, dan getaran halus saat menempel)

### 10.4 Tugas
- **Tangkap cepat** di paling atas: satu field judul dan tombol simpan, tidak lebih. Default diam-diam:
  `P3`, 1 pomodoro, tanpa kategori, status `inbox`. Menangkap "telepon balik Pak Budi" di tengah rapat
  tidak boleh berarti melewati sembilan kontrol; sisanya diisi belakangan di detail, atau tidak
  sama sekali. Ini tetap chip dan default — **bukan** input bahasa natural (§14).
- Daftar backlog dengan filter cepat: kategori, prioritas, tag, jatuh tempo
- **Ketuk** = buka detail (§10.8)
- **Swipe kanan** = tandai selesai (langsung, dengan undo 5 detik)
- **Swipe kiri** = ungkap dua aksi: **Kapan?** (§10.2) · **Hapus**. Dulu tiga, dengan "Jadwalkan"
  dan "Tunda" berdiri terpisah; keduanya kini satu sheet, karena pengguna mengajukan satu
  pertanyaan dan seharusnya tidak diminta memilih dulu bentuk jawabannya.
- **Tekan-tahan** = masuk mode seleksi (checkbox), untuk perencanaan pekanan atau aksi massal
- Prioritas dirender sebagai **batang warna di tepi baris**, bukan teks "P1": slot kiri baris milik
  checkbox, dan sebuah kode yang harus diterjemahkan sendiri bukan informasi sekilas.
- Drag untuk menyusun ulang urutan hanya aktif di dalam mode seleksi/urutkan, agar tidak bentrok
  dengan gestur swipe

### 10.5 Kalender

Kalender adalah permukaan **perencanaan**, dan **dibuka ke mode Pekan**. Mode Hari tetap ada, tapi
sebagai **tujuan** — dicapai dengan mengetuk kolom pekan, dari mode bawa, atau lewat deep link
`?tanggal=YYYY-MM-DD` — bukan sebagai tampilan default. Sebelumnya Kalender membuka pita hari yang
nyaris identik dengan Hari Ini, sehingga dua dari empat tab menampilkan hal yang sama; hari adalah
pekerjaan Hari Ini (§10.3), dan Kalender menjawab pertanyaan yang hanya bisa ia jawab: **di mana
ada ruang pekan ini**.

- Tanggal aktif hidup di **URL**, bukan di state komponen: itu yang membuat mode bawa bisa
  mengantar pengguna ke satu hari tertentu lalu memulangkannya (§10.2), dan yang membuat tanggal
  bertahan saat pengguna mampir ke tab lain.
- Mode **Pekan** (kolom padat, ketuk kolom untuk masuk ke hari) dan mode **Hari** (pita vertikal).
  Mode Hari **wajib** punya tombol **"Hari ini"** di samping panah ‹ ›: tanpa itu, menjelajah enam
  hari ke depan berarti enam ketukan untuk pulang.
- Overlay yang selalu terbaca: availability window (di luar jam = redup), blok sholat, time block
  (warna sendiri), busy GCal (arsir netral)
- **Tekan-tahan blok agenda** = angkat, pindahkan, lepas (snap 5 menit). **Pegangan bawah** = ubah
  durasi. Keduanya intra-layar, jadi aman di ponsel.
- **Mengubah durasi menulis balik `allocatedPomodoros`.** Resize menempel ke kelipatan satu
  pomodoro + break, dan label bayangan saat menarik berbunyi "3 → 4 pomodoro · 1j 55m". Panjang
  blok dan stepper di detail task **selalu angka yang sama**; durasi non-pomodoro ditolak secara
  desain, bukan disimpan diam-diam sebagai angka kedua yang bertengkar dengan yang pertama.
- Setiap pelanggaran saat melepas → sheet konfirmasi yang menyebut pelanggarannya secara spesifik
- Tombol **+** di kanan bawah membuka pemilih task → langsung masuk mode bawa (§10.2 Jalur B)
- **Tidak ada baki task (task tray) di ponsel.** Fitur itu hanya muncul pada layout ≥768px.

### 10.6 Perencanaan pekan
- Masuk dari tab Tugas → mode seleksi → **Alokasikan otomatis**
- Draft ditampilkan sebagai overlay di kalender pekan, warna berbeda dari agenda nyata
- Per item: terima / tolak / **geser** (masuk mode bawa untuk item itu). Tampilkan `reason` tiap item.
- Item yang tidak dapat slot muncul di panel bawah beserta alasannya
- Tombol **Commit** menulis semua yang diterima sekaligus → satu momen perayaan (bukan per item)

### 10.7 Peninjauan agenda lewat (D7)
Muncul otomatis saat app dibuka bila ada `agenda.endAt < now && status === 'planned'`.
Satu kartu per agenda, dapat diselesaikan dengan satu ketukan:
**Selesai** · **Sebagian** (catat pomodoro terpakai) · **Tunda** (chip cepat) ·
**Lewati** (agenda dihapus, task kembali ke backlog).

**Antrean tidak boleh pecah di tengah jalan.** Di dalam peninjauan hanya ada aksi yang selesai
**di tempat**. "Pilih di kalender" tidak langsung membuka mode bawa — ia **menandai** item itu dan
memindahkannya ke akhir antrean; mode bawa dibuka setelah antrean habis, satu per satu, masing-masing
dengan `returnTo` kembali ke antrean (§10.2). Tanpa aturan ini, kartu ketiga melempar pengguna ke
tab Kalender dan empat kartu sisanya hilang dari layar — dan DoD M7 ("meninjau 5 agenda lewat
selesai dalam <20 detik dengan satu ibu jari") tidak mungkin tercapai.

Kartu bisa juga **di-swipe kanan untuk Selesai** agar meninjau lima agenda terasa seperti satu gerakan.
Tulisan harus netral dan tidak menghakimi. Judul: "Bagaimana kemarin berjalan?" — bukan
"Anda melewatkan 4 agenda".

### 10.8 Detail task (bottom sheet)
Judul, catatan, kategori, prioritas, tags, due date, alokasi pomodoro (stepper), sub-task
(dapat dijadwalkan sendiri), dependency, daftar agenda terkait, riwayat pomodoro.

**Bertahap, bukan sembilan field sekaligus.** Task lahir dari tangkap cepat (§10.4); detail
**menampilkan hanya field yang sudah terisi**, plus satu baris "Tambah: kategori · tag ·
dependency · sub-task" yang memunculkan sisanya sesuai kebutuhan. Sembilan kontrol terbuka
serentak mengubah pencatatan lima detik menjadi formulir.

### 10.9 Setelan
Jam tersedia per hari · buffer default · waktu sholat (lokasi, metode, durasi, aktif/nonaktif per waktu, opsi kirim ke GCal) · pomodoro (durasi, suara) · kategori & tag · time block · koneksi Google (kalender tujuan, kalender yang dibaca) · level perayaan · ekspor data (JSON).

**Yang tergambar, diedit di tempatnya.** Mengubah durasi blok Ashar tidak boleh berarti Kalender →
Setelan → gulir → sholat → Ashar → kembali ke Kalender untuk melihat hasilnya. Ketuk blok sholat di
pita hari → sheet durasi & aktif untuk waktu itu (plus "hanya hari ini" → `PrayerOverride`).
Tekan-tahan area redup → sheet jam tersedia untuk hari itu. Setiap editor ditulis **sekali** sebagai
komponen sheet dan dipakai dari kedua tempat.

Tab Setelan tetap ada sebagai **indeks lengkap**, dan sebagai satu-satunya rumah bagi hal yang tidak
punya wujud visual di layar mana pun: zona waktu, koneksi Google, ekspor data, level perayaan.

**Tidak ada nilai mentah di antarmuka.** `full`/`subtle`/`off`, nama metode perhitungan, dan date key
`2026-09-01` adalah format penyimpanan; yang tampil selalu bentuk Indonesianya ("Penuh",
"Kemenag RI", "Selasa, 1 September 2026"). Peta labelnya tinggal di `packages/core/src/format/id.ts`,
tempat yang sama dengan pesan pelanggaran (§5.5) — bukan dirakit ulang di React.

### 10.10 Ringkasan gestur (kontrak — jangan menambah gestur di luar tabel ini)

| Gestur | Konteks | Aksi | Alternatif ketukan |
|---|---|---|---|
| Ketuk | task / agenda | Buka detail | — |
| Swipe kanan | baris task, kartu peninjauan | Tandai selesai (undo 5 dtk) | Checkbox di detail |
| Swipe kiri | baris task | Ungkap Kapan? / Hapus | Menu "..." di detail |
| Tekan-tahan | baris task | Mode seleksi | Tombol "Pilih" di header |
| Tekan-tahan + drag | blok agenda (intra-layar) | Pindahkan slot | Ubah waktu di detail agenda |
| Drag pegangan | blok agenda | Ubah durasi | Stepper durasi di detail agenda |
| Swipe horizontal | kanvas kalender | Hari/pekan sebelumnya-berikutnya | Panah di header |

Target sentuh ≥44px. Blok agenda yang lebih pendek dari 30 menit tetap dirender minimal 44px tinggi
dengan label terpotong — jangan pernah menghasilkan target yang tidak bisa disentuh.
## 11. Arah desain

Jangan pakai tampilan produktivitas generik. Rencana token berikut sudah dipilih untuk brief ini —
ikuti, dan jika menyimpang, tulis alasannya di `PLAN.md`.

**Palet** — diambil dari lanskap Bandung: batu vulkanik, kebun teh, kabut pagi.
- `ink` `#16232B` — teks utama, latar mode gelap
- `paper` `#EFF1EC` — latar utama (abu-hijau dingin, bukan krem hangat)
- `tea` `#1F6F5C` — aksi utama, agenda terjadwal
- `ember` `#E8A33D` — pomodoro & fokus aktif (satu-satunya warna panas)
- `dusk` `#6B4B7A` — blok sholat
- `mist` `#8FA09B` — teks sekunder, garis, area di luar jam tersedia

**Tipografi** — hindari kombinasi serif display + Inter yang serba bisa.
- Display: **Bricolage Grotesque** (rapat, berkarakter) — hanya untuk judul layar dan angka besar
- Body/UI: **Public Sans**
- Data & timer: **Martian Mono** — angka pomodoro, jam, durasi

**Wordmark FOQUS.** Set dalam Bricolage Grotesque, huruf kapital, tracking rapat. Ekor huruf **Q**
diperpanjang menjadi garis vertikal pendek — kutipan langsung dari pita hari. Itu saja; tanpa ikon
tambahan, tanpa gradien. Ikon PWA: huruf Q dengan ekor tersebut di atas `ink`.

**Elemen tanda tangan: "pita hari" (day ribbon).**
Satu pita vertikal kontinu mewakili satu hari. Yang membuatnya berbeda:
- **Waktu sholat adalah takik tetap** di tepi pita — jangkar visual yang tidak bergerak, membuat hari
  terbaca sebagai lima segmen alami, bukan grid 24 jam yang seragam.
- **Buffer digambar sebagai arsir miring**, bukan ruang kosong — pengguna melihat bahwa jeda itu
  disengaja dan dilindungi, bukan celah yang perlu diisi.
- **Titik pomodoro berada di dalam blok agenda**, terisi secara real-time saat sesi berjalan.

Tiga aturan tata letak yang membuat pita hari terpakai di ponsel, bukan sekadar tergambar:
- **Pita menggulir sendiri dan mendarat di "sekarang".** Satu hari 04:00–23:00 pada 56px/jam lebih
  dari seribu piksel; menumpang scroll halaman berarti ponsel terbuka di jam 4 pagi.
- **Jam kosong di luar jam tersedia terlipat** menjadi satu pita bernama ("05:05–08:00 · di luar jam
  tersedia") yang bisa diketuk untuk dibuka. Tidak ada yang disembunyikan — jamnya disebut — tapi
  waktu mati berhenti memakan layar.
- **Blok yang bertumpuk berbagi lebar.** Blok 15 menit tetap dirender minimal 44px agar bisa
  disentuh (§10.10), dan justru lantai itu yang membuatnya menutupi tetangganya; yang dibagi kolom
  adalah blok yang bertumpuk **secara visual**, bukan hanya yang bertumpuk secara waktu.
- Sisi kiri di dalam pita adalah **gutter label sholat**; blok agenda tidak pernah masuk ke situ,
  supaya nama waktu sholat tidak tertimpa agenda di jam yang sama.
- Alasan ditulis sebagai **teks**, tidak pernah sebagai atribut `title`: tooltip tidak ada di layar
  sentuh, sementara §10.5 mewajibkan area redup menyebutkan alasannya.

**Gerak & perayaan** (hormati `prefers-reduced-motion`, dan setting `celebration`):
- Task selesai → centang yang menggambar dirinya + getar halus (`navigator.vibrate(10)`)
- Semua agenda hari ini tertinjau → pita "menutup" dengan animasi singkat + confetti
- Commit rencana pekanan → confetti sekali
- Cincin progres pekanan di header — tenang, tidak berdenyut
Confetti hanya untuk tiga momen di atas. Kalau semuanya dirayakan, tidak ada yang terasa dirayakan.

**Skala tipe.** 12px adalah **lantai** — tidak ada teks yang dibaca pengguna dirender lebih kecil,
dan Martian Mono khususnya tidak terbaca di bawah itu. Dua langkah bernama, bukan angka lepasan:
`--text-label` (12px) untuk metadata, `--text-meta` (13px) untuk baris sekunder.

**Standar dasar tanpa perlu diumumkan:** target sentuh ≥44px, area aman iOS, fokus keyboard terlihat,
kontras AA, mode gelap, dan seluruh alur utama dapat diselesaikan dengan satu ibu jari.

---

## 12. Deployment & konfigurasi

**Vercel project** — satu project, Root Directory `apps/web`, Install Command `pnpm install`
(dijalankan dari root repo), Build Command `pnpm build`, Output `dist`.

**Tidak ada Vercel Cron di v1.** Jangan menambahkan blok `crons` ke `vercel.json`.

Batas paket Hobby yang relevan:
- Cron **maksimal sekali sehari**. Ekspresi yang lebih sering (`0 * * * *`, `*/15 * * * *`)
  **menggagalkan deploy** dengan error `Hobby accounts are limited to daily cron jobs` —
  bukan diturunkan diam-diam. Maksimal 2 cron job per project, waktu pemanggilan hanya dijamin
  dalam jam yang ditentukan, dan selalu UTC.
- **Durasi function 10 detik.** Ini yang membentuk desain §7: sedikit item per request, klien
  memanggil berulang.

Keputusan: cron harian tidak memberi nilai untuk FOQUS. Agenda hanya lahir saat aplikasi dibuka,
jadi jalur `waitUntil` + `POST /api/sync/drain` saat app dibuka/kembali online sudah menutup
seluruh skenario nyata. Endpoint `/api/cron/drain-outbox` tetap dibangun dan dilindungi
`CRON_SECRET` agar penjadwal eksternal (cron-job.org, GitHub Actions schedule) atau Vercel Cron di
paket Pro bisa dipasang belakangan **tanpa perubahan kode** — cukup daftarkan URL-nya.

**Environment variables** (`.env.example` wajib lengkap):
```
DATABASE_URL=                # Neon pooled connection string
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=         # https://<domain>/api/auth/google/callback
SESSION_SECRET=              # tanda tangan JWT session
TOKEN_ENC_KEY=               # 32-byte base64, AES-GCM untuk refresh token
CRON_SECRET=                 # verifikasi header Authorization dari Vercel Cron
APP_URL=
```

Lindungi `/api/cron/*` dengan `CRON_SECRET` — endpoint itu publik kalau tidak dijaga.

`README.md` wajib memuat: setup Google Cloud OAuth dari nol (buat project, aktifkan Calendar API,
consent screen, scope, redirect URI), setup Neon, cara menjalankan migrasi, dan catatan keterbatasan
notifikasi iOS (§9).

---

## 13. Milestone

Kerjakan berurutan. Berhenti dan minta review di akhir tiap milestone.

- **M0 — Fondasi.** Monorepo, tooling, skema Drizzle **lengkap untuk full spec** (§4) di Postgres, migrasi, seed data contoh, Dexie mirror, shell PWA + branding FOQUS, login Google + penyimpanan token terenkripsi, **deploy ke Vercel sejak hari pertama**.
  *DoD:* bisa login di URL produksi, data seed tampil, FOQUS terpasang sebagai PWA di ponsel, `pnpm test` hijau.
- **M1 — Task.** CRUD task, kategori, tag, prioritas, due date, sub-task, dependency (dengan deteksi siklus), alokasi pomodoro, filter, swipe, layar Hari Ini.
  *DoD:* seluruh atribut task dapat dikelola dari ponsel tanpa keyboard eksternal.
- **M2 — Agenda & kalender.** Availability window, buffer, blok sholat (adhan-js, default Bandung), tampilan hari & pekan, **sheet "Kapan?" + mode bawa** (§10.2), pindah/ubah durasi blok agenda (menulis balik `allocatedPomodoros`), hapus agenda (task tetap), dialog override yang spesifik.
  Jalur A butuh mesin skoring, sementara `allocate()` penuh baru di M6: M2 membangun
  `suggestSlots()` — varian **satu task** di atas fondasi yang sudah ada dan teruji
  (`freeIntervals()`, `candidateSlots()`, `detectViolations()`, `reservedDurationMin()`), dan M6
  menggeneralisasikannya jadi multi-task dengan urutan topologis dan split.
  *DoD:* invariant §5.1–§5.6 punya test dan lulus; **setiap alur penjadwalan dapat diselesaikan tanpa satu pun gerakan drag** (uji Playwright dengan klik saja).
- **M3 — Google Calendar.** Buat kalender "FOQUS — Agenda", outbox di Postgres, jalur `waitUntil` + `/api/sync/drain` (dipanggil berulang oleh klien sampai antrean bersih), push create/update/delete, FreeBusy read + tampilan bentrok, indikator status sync & penanganan error.
  *DoD:* agenda muncul di Google Calendar dalam <10 detik; menghapus agenda menghapus event; mematikan koneksi di tengah proses lalu membuka app kembali → outbox terkuras sampai bersih.
- **M4 — Pomodoro.** Layar fokus, timer timestamp, wake lock, ticking + bell, notifikasi selesai, log sesi, simbol ○/● di agenda dan task.
  *DoD:* mulai sesi → kunci layar 26 menit → buka app → sesi tercatat benar tanpa drift.
- **M5 — Offline.** Service worker, offline read penuh, tiga mutasi offline (§8), outbox klien + retry, indikator koneksi, penonaktifan kontrol yang butuh online.
  *DoD:* mode pesawat: buka app, lihat hari ini, centang selesai, jalankan pomodoro; online kembali → semua tersinkron.
- **M6 — Time block & smart allocation.** Time block one-time & recurring dengan filter, perencanaan pekanan, mesin `allocate()` + test, review draft, commit.
  *DoD:* mesin tidak pernah melanggar §5.4 di seluruh test; tiap item draft punya alasan.
- **M7 — Peninjauan & perayaan.** Prompt realisasi otomatis, tunda/jadwal ulang cepat, animasi sukses, cincin progres, confetti, mode gelap, polesan aksesibilitas.
  *DoD:* meninjau 5 agenda lewat selesai dalam <20 detik dengan satu ibu jari.

---

## 14. Non-goal v1

Multi-pengguna/tim · sinkronisasi dua arah · impor event GCal menjadi task · input bahasa natural ·
fitur AI apa pun · kolaborasi/berbagi · kalender Apple/Outlook · pengeditan penuh saat offline ·
notifikasi/reminder agenda dari aplikasi (D11) · aplikasi native.

---

## 15. Cara kerja yang saya harapkan

- Tulis `PLAN.md` dulu; tunggu konfirmasi sebelum menulis kode.
- Satu milestone per sesi. Akhiri tiap milestone dengan ringkasan singkat: apa yang jadi, apa yang belum, keputusan teknis yang kamu ambil sendiri.
- **Test dulu untuk `packages/core`.** Aturan penjadwalan tanpa test dianggap belum selesai.
- Jangan menambah dependency di luar §3 tanpa menyebutkan alasannya lebih dulu.
- **Tidak ada kode yang mengasumsikan filesystem persisten, state dalam memori antar request, atau proses yang hidup terus.** Vercel akan mematahkan asumsi itu tanpa peringatan.
- Jika ada ambiguitas di brief ini, **tanya sebelum menebak** — kecuali ambiguitasnya kecil, maka
  ambil keputusan, kerjakan, dan catat di `DECISIONS.md`.
- Tidak ada secret di klien. `.env.example` harus lengkap dan `README.md` harus memuat langkah
  setup Google Cloud OAuth dari nol.
