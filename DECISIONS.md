# DECISIONS.md — FOQUS

Catatan keputusan yang **saya ambil sendiri** selama eksekusi, sesuai BRIEF §15
(“Jika ada ambiguitas di brief ini, tanya sebelum menebak — kecuali ambiguitasnya kecil, maka
ambil keputusan, kerjakan, dan catat di `DECISIONS.md`”).

Decision log yang sudah dikunci pemilik produk ada di BRIEF §2 (D1–D14) dan **tidak** diulang di
sini. Yang tercatat di bawah adalah konsekuensi teknis dan celah kecil di brief.

Format: **A#** = keputusan proses, **T#** = keputusan teknis, **U#** = keputusan antarmuka.
Setiap entri menyebut apa yang diputuskan, mengapa, dan apa yang akan membatalkannya.

---

## A — Proses

### A1. Menulis `PLAN.md` lalu langsung mengeksekusi M0, tanpa menunggu konfirmasi

BRIEF §15 meminta `PLAN.md` dulu dan menunggu konfirmasi. Instruksi sesi ini adalah “baca
BRIEF.md, **lalu mulailah eksekusi**”, yang saya baca sebagai konfirmasi itu sendiri.
`PLAN.md` tetap ditulis lebih dulu dan tetap menjadi kontrak rencana.

Ruang lingkup sesi ini dibatasi ke **M0 saja**, karena §13 dan §15 sama-sama meminta satu
milestone per sesi dengan checkpoint review di akhirnya.

### A2. Deploy ke Vercel disiapkan penuh, tapi tidak dieksekusi

DoD M0 menyebut “bisa login di URL produksi”. Saya tidak punya kredensial Vercel, Google Cloud,
maupun Neon, jadi tiga hal itu **tidak bisa saya verifikasi** dan saya tidak mengklaimnya
selesai. Yang saya kerjakan sampai tuntas:

- `apps/web/vercel.json` (Root Directory `apps/web`, framework Vite, SPA rewrite yang
  mengecualikan `/api/`, tanpa blok `crons` — §12);
- `.env.example` lengkap;
- README dengan langkah setup Google Cloud OAuth dari nol, setup Neon, dan cara migrasi;
- migrasi SQL pertama sudah dibuat (`packages/db/migrations/0000_init.sql`).

Yang tersisa untuk pemilik: buat project Vercel/Neon/Google Cloud, isi env, jalankan
`pnpm db:migrate`, deploy, lalu uji login. Sisa DoD M0 (`pnpm test` hijau, `pnpm build` hijau,
data seed tampil, manifest & ikon PWA) sudah diverifikasi di sini.

### A3. Verifikasi UI dilakukan dengan render nyata, bukan asumsi

Keempat layar (Hari Ini · Tugas · Kalender · Setelan) dan layar login dirender di Chromium
headless terhadap build produksi, dengan payload `/api/bootstrap` tiruan yang berbentuk sama
dengan yang dikembalikan server. Ini yang menemukan dua bug nyata sebelum di-commit — lihat T11.

---

## T — Teknis

### T1. UUIDv7 diimplementasikan sendiri di `packages/core`, bukan lewat dependency

BRIEF §4 mewajibkan UUIDv7 dibuat di klien tapi tidak menyebut library. Implementasi RFC 9562
§5.7 hanya ~40 baris murni, dan `packages/core` dirancang bebas dependency (§3). Sebagai bonus,
generatornya bisa disuntik sumber waktu & acak sehingga test tetap deterministik.

Monotonik dalam satu milidetik (counter 12-bit), jadi ID tetap bisa dipakai sebagai kunci urut
database. Diverifikasi lewat test urutan.

**Membatalkannya:** kalau ternyata dibutuhkan varian UUID lain, pindah ke `uuid` v11.

### T2. Zona waktu ditangani dengan `Intl.DateTimeFormat`, tanpa library tanggal

§3 tidak mencantumkan date-fns/Luxon/Temporal, sementara §5.9 mewajibkan seluruh aturan
kalender dievaluasi di zona waktu pengguna. `Intl` adalah satu-satunya sumber data IANA yang
benar dan tersedia di Node maupun browser tanpa menambah dependency.

`zonedTimeToUtc()` memakai dua tahap (tebak offset, lalu baca ulang offset di kandidat instant)
supaya transisi DST tetap benar. Asia/Jakarta tidak punya DST, tapi zona waktu bisa diubah di
settings (§4.10), jadi ini bukan kode mati — ada testnya memakai `America/New_York`.

### T3. Semantik filter time block: OR di dalam grup, AND antar grup

§4.7 mendefinisikan `filter` dengan empat kriteria opsional tapi tidak menyebut bagaimana
keempatnya dikombinasikan. Keputusan: sebuah task lolos bila **untuk setiap grup kriteria yang
benar-benar diisi**, task cocok dengan minimal satu anggotanya. Filter tanpa kriteria sama
sekali menerima semua task.

Alasan: itu bacaan intuitif dari UI (“blok ini untuk kategori Riset **dan** prioritas P1”), dan
grup yang kosong tidak boleh menyempitkan apa pun. Ini penting karena hasilnya **binding** untuk
smart allocation (D6) — task yang gagal filter mendiskualifikasi slot, bukan sekadar menurunkan
skor.

Detektor mengembalikan **grup mana** yang gagal, sehingga pesan bisa spesifik
(“Blok Kerja Dalam — kategori tidak cocok”) sesuai §5.5.

### T4. Satu detektor pelanggaran, dua kebijakan

D6 membedakan constraint _advisory_ (alokasi manual) dan _binding_ (smart allocation). Godaan
alaminya adalah menulis dua jalur validasi — brief bahkan memperingatkan itu (“jangan pakai satu
jalur validasi untuk keduanya” dibaca sebagai: jangan samakan **kebijakannya**).

Keputusan: **satu** fungsi `detectViolations()` yang selalu mengembalikan daftar pelanggaran
bernama, plus satu himpunan `BINDING_KINDS`. Alokasi manual menampilkan semuanya di sheet
konfirmasi; `allocate()` membuang slot yang punya pelanggaran binding. Satu sumber kebenaran
untuk _apa_ yang dilanggar, dua kebijakan untuk _apa yang dilakukan_.

`past_due` dan `unfinished_dependency` sengaja **tidak** binding: §6.5 mengizinkan mesin jatuh
ke slot setelah tenggat kalau tidak ada pilihan lain, dan D5 melarang dependency memblokir.

### T5. Pesan pelanggaran dirakit di `core`, bukan di UI

§5.5 melarang kalimat generik. Kalau perakitan kalimat ada di React, akan ada dua tempat yang
harus tahu nama sholat, nama hari, dan format jam. Karena itu `packages/core/src/format/id.ts`
menyimpan seluruh formatting Bahasa Indonesia, dan `detectViolations()` mengembalikan pesan yang
sudah jadi (“Di luar jam Selasa 08:00–17:00”, “Menabrak blok Ashar 09:30–10:00”). Semuanya
punya test yang mengunci kalimatnya.

### T6. Blok sholat diturunkan, dan adhan dipanggil dengan `Date` konstruktor lokal

§4.8 sudah menetapkan blok sholat sebagai derived. Yang tidak disebut: adhan-js membaca
komponen tanggal sipil dari `Date` memakai zona waktu **runtime**, dan runtime Vercel adalah
UTC. Karena itu `derivePrayerBlocks()` membangun `new Date(year, month - 1, day)` dari date key
lokal pengguna — komponennya round-trip apa pun TZ servernya.

Ihtiyati diterapkan sebagai `adjustments` seragam di adhan, bukan digeser manual setelahnya,
supaya perhitungannya tetap satu jalur. Metode Kemenag RI = `CalculationMethod.Other()` dengan
Fajr 20° dan Isya 18°.

Test mengunci hasil untuk Bandung 2026-08-25: Subuh 04:37, Zuhur 11:54, Ashar 15:14,
Maghrib 17:52, Isya 19:02 (WIB).

### T7. Dependency dipasang ke Vite/React hanya saat milestone-nya tiba

§3 mencantumkan dnd-kit, rrule, dan canvas-confetti sebagai library kunci. Tidak satu pun
dipakai di M0 (drag = M2, RRULE = M6, confetti = M7). Memasangnya sekarang hanya menambah berat
lockfile tanpa kode yang memakainya, jadi ketiganya ditambahkan di milestone masing-masing.
Ini **bukan** penyimpangan dari §3 — pilihan library-nya tidak berubah.

### T8. `react-router-dom` ditambahkan (dependency di luar §3)

§3 tidak menyebut router. FOQUS butuh empat tab dengan URL sendiri (§10.1) dan, mulai M2, deep
link ke tanggal dan detail agenda. Menulis router sendiri berarti membangun ulang sesuatu yang
tetap dibutuhkan nanti, dan mengganti router di tengah jalan lebih mahal daripada memilihnya
sekarang.

Sesuai §15, alasannya dicatat di sini. Ini satu-satunya dependency runtime di luar §3.

### T9. Tailwind v4 dengan `@theme`, bukan v3 dengan `tailwind.config.js`

§3 hanya menyebut “Tailwind”. v4 adalah versi berjalan, dan token desain §11 (palet enam warna,
tiga typeface, target sentuh 44px) hidup lebih rapi sebagai custom property di `@theme` —
satu tempat, bisa dibaca DevTools, dan langsung tersedia sebagai utility class (`bg-tea`,
`text-mist`, `min-h-touch`).

### T10. Font Google Fonts lewat CDN + runtime caching Workbox, bukan `@fontsource`

Bricolage Grotesque, Public Sans, dan Martian Mono semuanya ada di Google Fonts. Men-_self-host_
lewat paket `@fontsource-*` akan menambah tiga dependency baru di luar §3. Sebagai gantinya
`vite-plugin-pwa` dikonfigurasi dengan resep standar: `StaleWhileRevalidate` untuk stylesheet
dan `CacheFirst` (1 tahun) untuk file font. Setelah kunjungan pertama, font tersedia luring —
yang justru syarat M5.

**Membatalkannya:** kalau kunjungan pertama di jaringan lambat terasa buruk, pindah ke
self-host dan catat tiga dependency-nya.

### T11. Dua bug ditemukan lewat render nyata, bukan lewat pembacaan kode

1. **Arsir buffer tidak muncul.** Versi pertama memakai `<pattern id>` SVG lalu mereferensikannya
   dari CSS `background: url(#id)` pada elemen HTML — itu tidak pernah bekerja; id pattern hanya
   bisa dirujuk dari atribut paint SVG. Diganti dengan `repeating-linear-gradient`.
2. **Jendela availability yang melewati tengah malam menghilang.** Potongan keduanya dihitung
   memakai `endTime` pada hari yang sama, sehingga interval terbalik dan dibuang. Sekarang
   potongan kedua memakai hari berikutnya. Ada testnya (`22:00–02:00`).

### T12. Algoritma AES-GCM dan JWT dipatok eksplisit

Refresh token Google dienkripsi AES-GCM dengan IV 96-bit baru setiap panggilan; ciphertext
disimpan sebagai `base64(iv).base64(ct)`. Kunci diimpor dari `TOKEN_ENC_KEY` dan **wajib** 32
byte — panjang yang salah gagal keras dengan pesan yang menyebut perintah pembuatannya.

Session JWT dipatok ke `HS256` di **sisi sign maupun verify**, sehingga token tidak bisa
diterima di bawah algoritma lain. Dipakai WebCrypto, bukan `node:crypto`, agar kode yang sama
berjalan di runtime Node maupun Edge Vercel.

### T13. `prompt=consent` pada OAuth, dan refresh token lama tidak ditimpa saat kosong

Google hanya mengembalikan refresh token pada pertukaran yang memberi consent. Tanpa
`prompt=consent`, login kedua dan seterusnya tidak membawa refresh token — dan penghubungan
ulang akun akan gagal diam-diam.

Sebagai jaring pengaman kedua: bila Google tetap tidak mengirim refresh token, callback
**mempertahankan** ciphertext yang sudah tersimpan alih-alih menimpanya dengan kosong.
Kehilangan refresh token akan mematikan seluruh push kalender tanpa gejala yang terlihat.

### T14. `POST /api/bootstrap` mengembalikan seluruh read model sekaligus

§8 menetapkan pola baca offline-first dari Dexie lalu revalidasi, tapi tidak menetapkan bentuk
endpoint-nya. Keputusan: satu `GET /api/bootstrap` yang mengembalikan seluruh read model dalam
satu round trip, dan mirror Dexie ditulis dengan **replace per tabel**, bukan merge.

Alasan replace: bootstrap adalah kebenaran lengkap dari server, jadi baris yang hilang darinya
berarti sudah dihapus dan tidak boleh tertinggal di klien. Outbox klien sengaja tidak disentuh —
isinya mutasi yang belum dilihat server.

### T15. Skema penuh sejak M0, termasuk tabel yang belum dipakai

D3 sudah mewajibkan ini; yang saya putuskan adalah **seberapa jauh** membawanya. Ke-18 tabel
§4 ada, termasuk `weekly_plans`, `allocation_drafts`, `sync_outbox`, dan `freebusy_cache` yang
baru terpakai di M3/M6. Mirror Dexie juga sudah punya tabel-tabel itu. Konsekuensinya, milestone
berikutnya hanya menambah query — bukan migrasi struktural.

Satu tambahan di luar §4: kolom `agendas.sync_error`, supaya pesan kesalahan sinkronisasi bisa
ditampilkan di UI beserta tombol “Coba lagi” (§7) tanpa harus menjoin ke outbox.

### T16. `allocate()` baru berupa kontrak, bukan stub yang mengembalikan kosong

§13 menempatkan mesin alokasi di M6. Menaruh fungsi yang mengembalikan array kosong akan menjadi
kode mati yang tidak bisa diuji dan mudah dikira sudah jalan. Sebagai gantinya
`scheduling/allocate.ts` hanya mengekspor tipe `AllocateInput`/`AllocateResult`/`AllocateFn`.

Semua fondasinya sudah jadi dan teruji: `freeIntervals()` (§6.3 diterjemahkan harfiah),
`candidateSlots()`, `detectViolations()`, `topologicalOrder()`, `reservedDurationMin()` (§6.4).
M6 tinggal menyusunnya dengan skoring.

### T17. Ikon PWA dihasilkan oleh script, bukan biner yang di-commit begitu saja

`scripts/generate-icons.mjs` menulis PNG langsung (encoder PNG + `node:zlib`, tanpa dependency
gambar). Marknya adalah huruf Q wordmark yang direduksi: cincin di atas `ink`, ekor diperpanjang
jadi garis vertikal pendek — kutipan pita hari yang sama dengan wordmark (§11).

Varian maskable memakai inset lebih besar agar mark tetap di dalam safe zone. Ikonnya bisa
diregenerasi kalau palet berubah.

---

## U — Antarmuka

### U1. Layar M0 menunjukkan apa yang sudah nyata, dan mengatakan sisanya belum ada

Keempat tab hidup sejak M0, tapi isinya hanya bagian yang sudah benar-benar berfungsi: pita
hari dengan waktu sholat yang dihitung lokal, backlog dari mirror, setelan yang sudah tersimpan.
Bagian yang belum dibangun ditandai dengan kalimat jujur (“Menjadwalkan task lewat slot usulan
dan mode bawa masuk di milestone berikutnya”), bukan tombol yang tidak melakukan apa-apa.

### U2. Setelan bersifat read-only di M0

§10.9 mendaftar banyak sekali yang bisa diedit. Menyediakan form untuk semuanya sekarang berarti
menulis M1–M6 lebih awal. Keputusan: M0 **menampilkan** state yang sudah ada (jam tersedia,
waktu sholat hari ini, pomodoro, zona waktu, buffer, koneksi Google) plus tombol Keluar.
Setiap setelan mendapat editornya di milestone yang memilikinya.

### U3. Panah navigasi hari ada sejak M0, sebelum swipe-nya dibangun

§10.10 mewajibkan setiap gestur punya alternatif ketukan. Membangun alternatifnya lebih dulu
memastikan gestur tidak pernah menjadi satu-satunya jalan — bahkan untuk sesaat.

### U4. Pita hari dibangun utuh sejak M0, meski agendanya baru M2

Pita hari adalah elemen tanda tangan (§11), dan bentuknya menentukan banyak keputusan tata
letak berikutnya. Komponennya sudah menggambar keempat lapisan: area di luar jam tersedia,
blok sholat dengan takik di tepi, blok agenda, dan buffer sebagai arsir miring — plus titik
pomodoro di dalam blok. Agenda dari data seed sudah tampil di sana sekarang.

### U5. `navigator.onLine` dipakai untuk indikator koneksi di M0

Indikator ini sengaja lemah: `navigator.onLine` melaporkan “online” untuk captive portal dan
uplink mati. Cukup untuk penanda halus di header (§8), dan M5 menggantinya dengan hasil drain
outbox — satu-satunya sinyal yang benar-benar membuktikan API terjangkau. Dicatat agar tidak
terlanjur dipercaya.

### U6. Logout membersihkan mirror Dexie

Tidak disebut di brief. Tanpa ini, akun berikutnya yang login di perangkat sama akan melihat
data akun sebelumnya sesaat sebelum bootstrap selesai. FOQUS memang aplikasi satu pengguna,
tapi biayanya satu baris.

---

## Yang sengaja **tidak** diputuskan sendiri

Hal-hal berikut ambigu tapi terlalu besar untuk ditebak. Semuanya akan ditanyakan saat
milestone-nya tiba:

- **Bobot skoring `allocate()` (§6.5).** Brief memberi arah (`+besar`, `−`, diskualifikasi) tapi
  bukan angka. Bobot menentukan perilaku mesin, dan pengguna akan merasakannya langsung.
- **Ambang “hari terlalu padat”.** §6.5 menyebut “>6 jam agenda terjadwal”; apakah itu termasuk
  buffer dan blok sholat belum jelas.
- **Perilaku `workdayStartPreference: 'even'`.** “Sebar merata antar hari” bisa berarti merata
  per hari atau merata per jam kerja tersedia.
- **Nasib agenda saat task-nya diselesaikan lebih awal.** §5.1 mengunci arah sebaliknya
  (hapus agenda ≠ hapus task), tapi arah ini tidak disebut.
