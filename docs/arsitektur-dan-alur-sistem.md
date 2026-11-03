# Arsitektur dan Alur Sistem Digital Shift Handover

Dokumen ini menggambarkan kondisi sistem yang berjalan saat ini, bukan rencana pengembangan. Sistem adalah PWA internal untuk serah terima shift operasional dengan UI berbahasa Indonesia.

## 1. Ringkasan

- Operator mengisi form handover, menyimpan draft, lalu submit ke supervisor.
- Supervisor mereview, menyetujui, menolak, membuka kembali, atau menghapus handover non-approved.
- Operator hanya dapat mengedit handover miliknya yang berstatus `draft` atau `reopened`.
- Data operasional utama disimpan di `handovers.operational_data` (JSONB).
- Log kegiatan disimpan di `handover_activities`.
- Aplikasi membaca dan menulis langsung ke Supabase; tidak ada API layer, Route Handler, atau Server Action.
- Google Sheets bukan bagian dari sistem yang aktif saat ini.

## 2. Stack dan Prinsip

| Bagian | Teknologi |
|---|---|
| Framework | Next.js 16 App Router |
| UI | React 19, TypeScript strict, Tailwind CSS v4 |
| Komponen | Komponen shadcn-style yang ditulis manual di `src/components/ui` |
| Ikon | `lucide-react` |
| Auth & database | Supabase (Postgres, Auth, Realtime, RLS) |
| Supabase client | `@supabase/ssr` dan `@supabase/supabase-js` |
| PWA | `public/manifest.json` + ikon; belum ada service worker/offline |
| Cetak | CSS print + `ResponsiveScale` |

Prinsip utama:

- Hampir semua halaman adalah client component yang memanggil Supabase langsung.
- `dashboard/page.tsx` adalah satu-satunya halaman dashboard yang server component; `app/page.tsx` hanya melakukan redirect.
- Mutasi dilakukan di client, lalu memberi feedback lewat `useToast`.
- Aksi destruktif memakai `useConfirm`.
- Alias import `@/*` mengarah ke `src/*`.

## 3. Diagram Arsitektur

```text
Browser / PWA
  │
  │  Supabase JS client (@supabase/ssr)
  ▼
Next.js 16 App Router
  ├─ middleware.ts        : cek sesi, refresh cookie, guard role
  ├─ (dashboard) layout   : Header + RealtimeSubscriber
  ├─ Client components    : query & mutasi langsung ke Supabase
  └─ Dashboard server page: query awal di server
  │
  ▼
Supabase
  ├─ Auth                 : login email/password, sesi cookie
  ├─ Postgres             : handovers, activities, approvals, profiles, shifts, dll.
  ├─ Row Level Security   : pembatasan data per role dan pemilik handover
  └─ Realtime             : notifikasi perubahan tabel handovers
```

## 4. Struktur Folder Penting

```text
src/
  app/
    login/                  Login email/password
    forgot-password/        Permintaan reset password
    reset-password/         Reset password
    (dashboard)/
      layout.tsx            Shell dashboard: Header + RealtimeSubscriber
      dashboard/            Dashboard supervisor (server component)
      handover/             Form buat handover
      handover/[id]/        Detail handover
      handover/[id]/edit/   Edit handover
      handover/[id]/print/  Dokumen cetak handover
      approvals/            Review & riwayat approval
      reports/              Daftar laporan, filter, export CSV/PDF
      reports/print/        Halaman cetak laporan
      settings/             Admin users & shifts (supervisor)
  components/
    header.tsx              Navigasi berdasarkan role
    realtime-subscriber.tsx Toast realtime untuk handover
    handover/
      shift-handover-document.tsx  Dokumen handover untuk detail/print
    ui/                     Komponen UI manual
  contexts/
    user-context.tsx        Sesi user + profil + role
    toast-context.tsx       Notifikasi
    confirm-context.tsx     Dialog konfirmasi
  lib/
    handover-types.ts       Tipe & helper data handover
    supabase/client.ts      Client browser
    supabase/server.ts      Client server
  middleware.ts             Auth & role guard
supabase/migrations/        Migrasi SQL manual (01–13)
public/manifest.json        Manifest PWA
```

## 5. Autentikasi dan Otorisasi

### Login

- Login memakai Supabase Auth email/password.
- Setelah login, form mengarah ke `/dashboard`.
- `/dashboard` adalah server component; jika role operator, langsung redirect ke `/handover`.
- Middleware juga mengarahkan user yang sudah login dan membuka `/login` ke `/dashboard` (supervisor) atau `/handover` (operator).
- Root `/` redirect ke `/dashboard` jika ada sesi, atau `/login` jika belum login.
- Lupa password memakai `supabase.auth.resetPasswordForEmail`; halaman `/reset-password` memakai `supabase.auth.updateUser`.

### Role

Role disimpan di `profiles.role`:

- `operator`
- `supervisor`

### Akses halaman

| Halaman | Operator | Supervisor |
|---|---:|---:|
| `/dashboard` | Tidak (redirect ke `/handover`) | Ya |
| `/handover` | Ya | Ya |
| `/approvals` | Ya (hanya handover miliknya) | Ya (semua) |
| `/reports` | Ya (hanya handover miliknya) | Ya (semua) |
| `/settings` | Tidak (redirect) | Ya |

Middleware memblokir operator dari `/dashboard` dan `/settings`. Halaman `/reports` sengaja dibuka untuk operator; pembatasan data dilakukan oleh RLS.

## 6. Halaman dan Fungsinya

### 6.1 `/handover` — Buat Handover

Form client-side untuk membuat handover baru:

- Tanggal otomatis hari ini.
- Shift/regu diambil dari tabel `shifts` yang aktif.
- Jam shift otomatis mengikuti `start_time`–`end_time` shift.
- Form number dibuat otomatis: `SH-YYYYMMDD-NNN` dengan 3 digit acak.
- Data yang diisi:
  - Level dan water tangki
  - Pemeriksaan QC
  - Peralatan operasi kritikal (Penerimaan, Penimbunan, Penyaluran)
  - Checklist safety tools
  - Permintaan transfer tangki
  - Tim yang menyerahkan/menerima/mengetahui
  - Log kegiatan
- Nomor tangki memakai dropdown dari `tank_products`; produk terisi otomatis.
- Input jam memakai time picker native. Aktivitas dan level tangki baru otomatis terisi jam sekarang.
- Sub-kegiatan disimpan dengan cara digabung ke `deskripsi` menggunakan pemisah `". "`.

Alur simpan:

```text
Isi form
  │
  ├─ Simpan Draft ──► insert handover status draft
  │                   insert activities
  │                   redirect ke detail
  │
  └─ Submit ────────► cek gate submit
                      insert handover status draft
                      insert activities
                      update status submitted + submitted_at
                      redirect ke detail
```

### 6.2 Submit Gate

Submit diblokir jika masih ada handover lain dengan status `submitted`, `rejected`, atau `reopened`.

- Create form: mengambil handover terbaru berdasarkan `created_at` tanpa filter operator.
- Edit form: query sama, tetapi mengecualikan handover yang sedang diedit.
- Draft selalu boleh disimpan.
- Gate ini hanya validasi UI, bukan constraint database.

### 6.3 `/handover/[id]` — Detail Handover

Menampilkan dokumen handover lengkap:

- Tombol Cetak PDF.
- Edit muncul untuk status `draft`/`reopened` jika user adalah pemilik atau supervisor.
- Reopen muncul untuk supervisor pada status `approved`, `rejected`, atau `submitted`.
- Hapus muncul untuk supervisor; handover `approved` tidak dapat dihapus.
- Dokumen memformat jam menjadi `HH:MM` agar tidak menampilkan detik.

### 6.4 `/handover/[id]/edit` — Edit Handover

- Supervisor dapat mengedit handover non-approved.
- Operator hanya dapat mengedit handover miliknya yang berstatus `draft` atau `reopened`.
- Sebelum activities dihapus/diinsert ulang, status parent dipaksa menjadi `draft` agar RLS child table lolos.
- Setelah disimpan, status akhir bisa `draft` atau `submitted`.

### 6.5 `/handover/[id]/print` — Cetak Handover

- Menampilkan `ShiftHandoverDocument`.
- `window.print()` otomatis hanya jika URL memiliki `?auto=true`.
- Tombol kembali mengarah ke detail.

### 6.6 `/approvals` — Review dan Riwayat

Tab:

- **Perlu Review**: handover status `submitted` dan `reopened`.
- **Riwayat**: handover status `approved` dan `rejected`, maksimal 50 data terbaru.

Perilaku:

- Kartu handover dapat diklik untuk membuka detail (mouse, Enter, atau Space).
- Tombol Detail tersedia untuk operator maupun supervisor.
- Aksi Setujui/Tolak/Reopen/Hapus hanya untuk supervisor.
- Operator hanya melihat handover miliknya karena RLS.

Aksi supervisor:

| Aksi | Perubahan |
|---|---|
| Setujui | `status = approved`, `supervisor_id`, `approved_at`; insert baris `approvals` |
| Tolak | `status = rejected`, `supervisor_id`, `approved_at`; insert baris `approvals` |
| Reopen | `status = reopened`, `reopened_at` |
| Hapus | Delete handover non-approved |

### 6.7 `/dashboard` — Dashboard Supervisor

Server component yang menampilkan:

- Jumlah handover hari ini.
- Outstanding jobs berstatus `pending`/`in_progress`.
- Jumlah handover yang menunggu approval.
- Tren handover 7 hari.
- Distribusi per regu shift.
- Status handover 7 hari terakhir.
- Aktivitas handover terbaru.
- Quick action ke handover, approvals, dan reports.

Operator tidak dapat membuka halaman ini.

### 6.8 `/reports` — Laporan

- Filter tanggal dan status.
- Pagination 20 data per halaman.
- Export CSV.
- Cetak PDF lewat `/reports/print`.
- Operator hanya melihat handover miliknya karena RLS.
- Export CSV melakukan sanitasi nilai yang diawali `=`, `+`, `-`, atau `@`.

### 6.9 `/reports/print` — Cetak Laporan

- Mengambil data sesuai filter `date` dan `status`.
- Otomatis memanggil `window.print()` setelah data selesai dimuat.

### 6.10 `/settings` — Administration

Hanya supervisor. Berisi tab:

- **Users**: CRUD data `profiles`.
- **Shifts**: CRUD `shifts` (nama, jam mulai, jam selesai).

Tab Users mengelola baris `profiles`, bukan membuat akun Supabase Auth. Pembuatan akun Auth tetap dilakukan di Supabase. Master `tank_products` belum memiliki UI pengelolaan; data diisi lewat migrasi/seed.

## 7. Siklus Status Handover

```text
draft ──submit──► submitted ──approve──► approved
  ▲                   │
  │                   └──reject──► rejected
  │                                   │
  │                                   └──reopen──► reopened
  │                                                   │
  └──────────────── edit/save ◄───────────────────────┘
                         │
                         └──submit──► submitted
```

Status yang dipakai:

- `draft`
- `submitted`
- `approved`
- `rejected`
- `reopened`

Catatan:

- Reopen dapat dilakukan supervisor dari status `approved`, `rejected`, atau `submitted`.
- Saat operator menyimpan hasil edit dari `reopened`, parent terlebih dahulu dikembalikan ke `draft`; jika submit, langsung menjadi `submitted`.
- Handover `approved` tidak bisa diedit operator dan tidak bisa dihapus.

## 8. Model Data

### 8.1 Tabel utama

#### `profiles`

| Kolom | Keterangan |
|---|---|
| `id` | UUID, terhubung ke `auth.users` |
| `email` | Email user |
| `full_name` | Nama lengkap |
| `role` | `operator` atau `supervisor` |
| `phone` | Nomor telepon |
| `is_active` | Status aktif |
| `created_at`, `updated_at` | Timestamp |

#### `shifts`

| Kolom | Keterangan |
|---|---|
| `id` | UUID |
| `name` | Nama shift/regu |
| `start_time`, `end_time` | Jam shift (`time`) |
| `is_active` | Hanya shift aktif yang dipakai form |
| `slots` | JSONB; ada di DB, belum dipakai form saat ini |
| `created_at`, `updated_at` | Timestamp |

#### `handovers`

| Kolom | Keterangan |
|---|---|
| `id` | UUID |
| `form_number` | Nomor unik `SH-YYYYMMDD-NNN` |
| `tanggal` | Tanggal handover |
| `shift_id` | Relasi ke `shifts` |
| `operator_id` | Relasi ke `profiles` |
| `supervisor_id` | Diisi saat approve/reject |
| `kondisi_operasional` | Kondisi operasional |
| `kendala`, `safety_issue`, `catatan` | Catatan tambahan |
| `status` | `draft`, `submitted`, `approved`, `rejected`, `reopened` |
| `submitted_at` | Waktu submit |
| `approved_at` | Diisi saat approve/reject |
| `rejected_at` | Ada di DB; alur app saat ini memakai `approved_at` untuk reject |
| `reopened_at` | Waktu reopen |
| `operational_data` | JSONB seluruh data operasional |
| `created_at`, `updated_at` | Timestamp |

#### `handover_activities`

| Kolom | Keterangan |
|---|---|
| `id` | UUID |
| `handover_id` | Relasi ke `handovers` |
| `waktu` | `time`, opsional/nullable |
| `aktivitas` | Judul kegiatan |
| `deskripsi` | Gabungan aktivitas + sub-kegiatan, dipisah `". "` |
| `status` | Default `completed` |
| `created_at`, `updated_at` | Timestamp |

#### `approvals`

| Kolom | Keterangan |
|---|---|
| `id` | UUID |
| `handover_id` | Relasi ke `handovers` |
| `supervisor_id` | Supervisor yang memutuskan |
| `status` | `approved` atau `rejected` |
| `comment` | Catatan (opsional) |
| `approved_at` | Waktu keputusan |
| `created_at` | Timestamp |

#### `tank_products`

| Kolom | Keterangan |
|---|---|
| `no_tanki` | Primary key, nomor tangki |
| `produk` | Nama produk |
| `sort_order` | Urutan dropdown |
| `is_active` | Hanya data aktif yang dipakai form |
| `created_at`, `updated_at` | Timestamp |

Seed saat ini: tangki 1–14.

#### `outstanding_jobs`

Dibaca oleh dashboard untuk menghitung pekerjaan berstatus `pending`/`in_progress`.

Kolom: `id`, `handover_id`, `judul`, `deskripsi`, `prioritas`, `pic`, `deadline`, `status`, `created_at`, `updated_at`.

Belum ada alur input outstanding jobs di UI saat ini.

#### `audit_trail`

Ditulis otomatis oleh trigger database saat `handovers` di-INSERT/UPDATE/DELETE.

Kolom: `id`, `table_name`, `record_id`, `action`, `old_data`, `new_data`, `performed_by`, `performed_at`.

Hanya supervisor yang dapat membaca audit trail.

### 8.2 Bentuk `operational_data`

```json
{
  "reguShift": "regu2",
  "shiftName": "Regu 2 / Sore",
  "jamShift": "16:00 s/d 24:00",
  "tankLevels": [
    {
      "jam": "18:50",
      "produk": "Pertalite",
      "noTanki": "11",
      "level": "75",
      "water": "0",
      "keterangan": ""
    }
  ],
  "qcChecks": [
    {
      "noSarfas": "",
      "visual": "",
      "density": "",
      "temperatur": "",
      "keterangan": ""
    }
  ],
  "criticalEquipment": [
    {
      "kategori": "Penerimaan",
      "namaPeralatan": "MOV",
      "status": "OK",
      "kondisi": "Berfungsi",
      "keterangan": ""
    }
  ],
  "safetyTools": [
    {
      "nama": "HT 1 (C. Room)",
      "status": "ADA",
      "kondisi": "Berfungsi",
      "keterangan": ""
    }
  ],
  "transferRequests": [
    {
      "noTangki": "5",
      "namaProduk": "Pertadex",
      "estJumlahKL": "300",
      "estimasiJam": "20:00",
      "keterangan": ""
    }
  ],
  "teams": {
    "yangMenyerahkan": {
      "danru": "",
      "anggota1": "",
      "anggota2": "",
      "anggota3": ""
    },
    "yangMenerima": {
      "danru": "",
      "anggota1": "",
      "anggota2": "",
      "anggota3": ""
    },
    "mengetahui": {
      "spv": ""
    }
  }
}
```

### 8.3 Tabel legacy

Tabel berikut masih ada di database tetapi tidak dipakai alur aplikasi saat ini:

- `handover_tank_levels`
- `handover_qc_checks`
- `handover_critical_equipment`
- `handover_safety_tools`
- `handover_transfer_requests`

Data operasional sekarang disimpan di `handovers.operational_data`. Jangan menambah alur baru ke tabel legacy tanpa migrasi data yang jelas.

## 9. RLS dan Keamanan

Ringkasan kebijakan utama:

### `handovers`

- SELECT:
  - Supervisor melihat semua.
  - Operator melihat handover miliknya.
- INSERT:
  - `operator_id = auth.uid()`.
- UPDATE:
  - Supervisor dapat mengubah semua.
  - Operator dapat mengubah miliknya yang berstatus `draft` atau `reopened`.
  - WITH CHECK operator hanya boleh menghasilkan status `draft` atau `submitted`.
- DELETE:
  - Supervisor dapat menghapus handover.
  - Operator dapat menghapus draft miliknya (RLS), tetapi tombol hapus di UI saat ini hanya untuk supervisor.
  - Handover `approved` tidak boleh dihapus.

### `handover_activities` dan child tables

- SELECT: pemilik handover atau supervisor.
- INSERT: pemilik handover saat status `draft`.
- UPDATE/DELETE: pemilik handover saat `draft` atau supervisor.

Karena itu, edit handover `reopened` terlebih dahulu mengubah parent menjadi `draft` sebelum menghapus/menambah activities.

### `tank_products`

- SELECT: semua user authenticated.
- INSERT/UPDATE/DELETE: supervisor.

### `audit_trail`

- SELECT: supervisor.
- INSERT: hanya lewat trigger database.

### Catatan keamanan

- Migration 10 mencabut akses `anon` ke view `handover_sync` dan mengubahnya menjadi `security_invoker = true`.
- Skrip Google Sheets lama di `scripts/sheets-sync/` tidak lagi berfungsi dengan konfigurasi sekarang.
- Jangan menjalankan ulang migration 01–09 setelah migration 10 karena migration awal membuat RLS permissive.

## 10. Realtime

`RealtimeSubscriber` dipasang di layout `(dashboard)` dan mendengarkan tabel `handovers`:

- INSERT dengan status `submitted` → toast info “Handover baru masuk: …”
- UPDATE dengan status `approved` → toast sukses “Handover … disetujui”

Halaman `/approvals` juga membuka channel realtime sendiri untuk memuat ulang daftar saat ada perubahan pada `handovers`.

## 11. PWA, Mobile, dan Cetak

- PWA hanya berupa manifest dan ikon; belum ada service worker, cache, atau mode offline.
- `ResponsiveScale` mengecilkan dokumen fixed-width agar tetap terbaca di layar kecil.
- CSS print menyembunyikan header, tombol, dan elemen non-dokumen.
- `/reports/print` otomatis membuka dialog print.
- `/handover/[id]/print` hanya auto-print jika `?auto=true`.

## 12. Migrasi dan Setup Lokal

### Environment

`.env.local` membutuhkan:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Perintah

```bash
npm run dev        # dev server, localhost:3000
npm run build      # production build
npm run start      # serve production build
npm run lint       # ESLint v9 flat config
npx tsc --noEmit   # typecheck
```

### Migrasi

Migrasi berupa file SQL manual di `supabase/migrations/NN_*.sql`. Tidak ada Supabase CLI config atau codegen. Jalankan berurutan.

| Migrasi | Isi |
|---|---|
| `01` | Tabel operasional awal + kolom `operational_data` |
| `02` | Policy & storage awal |
| `03` | Cascade delete handover |
| `04` | Hapus acknowledgement |
| `05` | Hapus areas |
| `06` | Cegah form number duplikat |
| `07` | Perbaikan policy update |
| `08` | Hapus fitur tak terpakai |
| `09` | View `handover_sync` |
| `10` | Security, RLS, audit trail, index |
| `11` | Master `tank_products` |
| `12` | `handover_activities.waktu` opsional |
| `13` | Operator boleh edit handover `reopened` |
| `14` | Schema `reporting` + role read-only `powerbi_reader` untuk Power BI |
| `15` | View dimensi star schema untuk Power BI |

## 13. Batasan dan Catatan Implementasi

- Tidak ada test suite, CI, atau pre-commit hook.
- `npm run lint` masih memiliki error lama `react-hooks/set-state-in-effect` di `src/app/(dashboard)/reports/print/page.tsx:52`.
- Form number dapat bertabrakan meskipun ada unique index; tabrakan muncul sebagai error insert Supabase.
- Submit gate hanya validasi UI; tidak ada constraint database yang mencegah submit ganda.
- `handover_activities.waktu` bertipe `time`, sehingga Supabase dapat mengembalikan `HH:MM:SS`; tampilan dokumen memotong detik menjadi `HH:MM`.
- `handover_activities` menyimpan sub-kegiatan dengan cara digabung ke `deskripsi`; saat edit/print, string dipecah kembali dengan `". "`.
- `outstanding_jobs` hanya dibaca dashboard; belum ada UI input.
- `tank_products` belum punya UI admin; perubahan data dilakukan lewat SQL/migrasi.
- `handover_sync` masih ada di database, tetapi bukan bagian dari alur aktif.
- Aplikasi belum memiliki mode offline.

## 14. Sinkronisasi Google Sheets

Rencana sinkronisasi Supabase → Google Sheets sudah tidak berlaku.

Kondisi saat ini:

- View `handover_sync` masih ada.
- Akses `anon` sudah dicabut.
- View memakai `security_invoker = true`.
- Skrip Apps Script/`scripts/sheets-sync/` lama tidak lagi kompatibel dengan konfigurasi keamanan sekarang.
- Tidak ada proses sinkronisasi otomatis yang berjalan di aplikasi.

Jika sinkronisasi dibutuhkan lagi, buat desain baru yang mempertimbangkan autentikasi, token, dan akses baca yang aman.

## 15. Integrasi Power BI

Power BI memakai jalur read-only terpisah dari aplikasi:

- Schema `reporting` berisi 9 view fakta dan 12 view dimensi yang sudah mem-flatten `operational_data`.
- Role `powerbi_reader` hanya mendapat `CONNECT`, `USAGE` schema `reporting`, dan `SELECT` ke view.
- Power BI Desktop memakai DirectQuery ke view tersebut; data tetap live tanpa Power BI Service.
- Proyek PBIP/TMDL siap pakai ada di `powerbi/`: model 12 dimensi + 9 fact + 45 relasi + 41 measure, serta laporan 3 halaman dan 35 visual.
- Menu `/powerbi` khusus supervisor menyediakan download `ShiftHandover.pbix` dari Supabase Storage private bucket `powerbi` lewat Route Handler `/api/powerbi/download`.
- Panduan koneksi, measures DAX, dan batasan ada di `docs/integrasi-power-bi.md`.

Jangan memberi `powerbi_reader` akses ke tabel `public`. Jika struktur `operational_data` berubah, update view lewat migration baru.
