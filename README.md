# Digital Shift Handover & Operation Logbook

PWA untuk serah terima shift dan logbook operasi. Operator mengirim handover; supervisor menyetujui, menolak, atau membuka kembali handover.

## Stack

- Next.js 16 App Router + React 19 + TypeScript
- Tailwind CSS v4
- Supabase Auth, Postgres, RLS, dan Storage

## Menjalankan lokal

```bash
npm install
npm run dev
```

Buat `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Jangan commit `.env.local` atau kredensial apa pun.

## Database

Migration ada di `supabase/migrations/`. Jalankan berurutan sesuai nomor. Migration `10_security_rls_audit_indexes.sql` adalah perbaikan keamanan; jangan menjalankan ulang migration `01`-`09` setelahnya.

## Power BI

Panduan integrasi ada di `docs/integrasi-power-bi.md`. Proyek PBIP ada di `powerbi/`. Ganti `<project-ref>` pada konfigurasi koneksi dengan project ref Supabase Anda. File `.pbix` dan kredensial tidak disimpan di repository.

## Catatan

- UI menggunakan Bahasa Indonesia.
- PWA memakai service worker production-only, cache aset statis, dan halaman offline fallback.
- File laporan `.pbix` diunduh supervisor dari Supabase Storage private bucket `powerbi` melalui halaman `/powerbi`.
