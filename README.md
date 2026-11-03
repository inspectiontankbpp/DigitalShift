# Digital Shift Handover & Operation Logbook

PWA untuk serah terima shift dan logbook operasi. Operator mengisi dan mengirim handover; supervisor menyetujui, menolak, atau membuka kembali handover. Seluruh antarmuka menggunakan Bahasa Indonesia.

## Fitur

- Form handover operasional: level tank, QC, peralatan kritis, safety tools, transfer request, tim shift, dan aktivitas.
- Alur status handover: `draft` -> `submitted` -> `approved` / `rejected` -> `reopened`.
- Dashboard supervisor: KPI, tren 7 hari, status handover, beban shift, kesiapan peralatan, dan level tank.
- Halaman laporan dan cetak dokumen handover.
- Unduh laporan Power BI khusus supervisor.
- PWA: dapat dipasang di perangkat, cache aset statis, dan halaman offline.
- Role-based access: operator dan supervisor memiliki menu serta izin berbeda.
- Audit trail perubahan handover ditulis otomatis oleh trigger database.

## Peran Pengguna

| Peran | Akses |
|---|---|
| `operator` | Membuat, menyimpan draft, mengirim, mengedit draft/reopened miliknya, melihat laporan miliknya, dan menghapus draft miliknya. |
| `supervisor` | Semua akses operator, ditambah dashboard, approvals, reopen, Power BI, settings, dan menghapus handover non-approved. |

Operator tidak dapat membuka `/dashboard`, `/powerbi`, dan `/settings`. Halaman `/reports` dapat dibuka operator, tetapi RLS membatasi data ke handover miliknya sendiri.

## Stack

- Next.js 16 App Router + React 19 + TypeScript strict
- Tailwind CSS v4
- Supabase Auth, Postgres, Row Level Security, dan Storage
- Power BI (schema `reporting` + proyek PBIP/TMDL)
- `lucide-react` untuk ikon

## Menjalankan Lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

Buat `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Jangan commit `.env.local`, service role key, atau kredensial apa pun.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Menjalankan development server di port 3000. |
| `npm run build` | Membuat production build. |
| `npm run start` | Menjalankan production build. |
| `npm run lint` | Menjalankan ESLint. |
| `npx tsc --noEmit` | Typecheck TypeScript. |

## Database

Migration berada di `supabase/migrations/` dan dijalankan manual berurutan sesuai nomor.

- Migration `10_security_rls_audit_indexes.sql` adalah perbaikan keamanan RLS.
- Jangan menjalankan ulang migration `01`-`09` setelah migration `10`.
- Tidak ada Supabase CLI config atau codegen di repository ini.

### Model Data Utama

- `handovers`: data handover dengan `form_number` unik, `status`, dan `operational_data` bertipe JSONB.
- `handover_activities`: baris aktivitas handover.
- `tank_products`: pemetaan nomor tank ke produk.
- `profiles`: menyimpan role `operator` atau `supervisor`.
- `approvals`: catatan approve/reject.
- `outstanding_jobs`: dibaca oleh dashboard.
- `audit_trail`: ditulis oleh trigger database pada tabel `handovers`.

Seluruh payload operasional (tank, QC, peralatan kritis, safety tools, transfer request, dan tim) disimpan di dalam `handovers.operational_data`. Tipe TypeScript-nya ada di `src/lib/handover-types.ts`.

### Aturan Penting

- Handover berstatus `approved` tidak dapat dihapus.
- Operator hanya dapat mengedit handover `draft` atau `reopened` miliknya.
- Handover `submitted`, `approved`, atau `rejected` harus di-reopen supervisor sebelum dapat diedit.
- Form pembuatan handover memblokir submit jika masih ada handover aktif berstatus `submitted`, `rejected`, atau `reopened`.

## Power BI

Lapisan reporting menggunakan schema `reporting` dan role read-only `powerbi_reader`.

- Panduan lengkap: `docs/integrasi-power-bi.md`
- Proyek PBIP/TMDL: `powerbi/`
- File `.pbix` tidak disimpan di repository.
- Supervisor mengunduh `ShiftHandover.pbix` dari Supabase Storage private bucket `powerbi` melalui halaman `/powerbi`.
- Ganti `<project-ref>` pada konfigurasi koneksi dengan project ref Supabase Anda.
- Jangan memberi `powerbi_reader` akses ke tabel `public`.

## PWA

- Manifest: `public/manifest.json`
- Service worker: `public/sw.js`
- Halaman offline: `public/offline.html`
- Service worker hanya didaftarkan pada production.
- Hanya aset statis yang di-cache. Request API, auth, dan Supabase tidak pernah di-cache.

## Struktur Proyek

```text
src/
  app/                 Halaman Next.js App Router
  components/          Komponen UI, handover, dashboard, dan PWA
  contexts/            User, toast, dan confirm provider
  lib/                 Supabase client, tipe, dan utilitas
supabase/migrations/   Migration SQL manual
docs/                  Dokumentasi arsitektur dan integrasi
powerbi/               Proyek Power BI PBIP/TMDL
public/                Manifest, service worker, ikon, dan offline page
```

## Deployment

1. Deploy ke Vercel atau platform Next.js lain.
2. Set `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Jalankan migration database berurutan.
4. Pastikan RLS aktif pada semua tabel `public`.
5. Untuk Power BI, unggah `ShiftHandover.pbix` ke bucket `powerbi` dan atur kredensial `powerbi_reader` di luar repository.

## Keamanan

- Jangan commit `.env.local`, `.pbix`, file kredensial, atau password database.
- Aplikasi hanya memakai anon key di client. Service role key tidak boleh diekspos ke browser.
- RLS adalah lapisan utama pembatasan data; jangan menonaktifkannya.
- Aktifkan email confirmation dan pertimbangkan menonaktifkan signup publik jika akses hanya untuk pengguna internal.
