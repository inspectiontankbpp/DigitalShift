# Panduan Developer

Dokumen ini untuk developer yang akan melanjutkan, merawat, atau mengembangkan aplikasi Digital Shift Handover & Operation Logbook.

## 1. Gambaran Singkat

Aplikasi ini adalah PWA internal untuk serah terima shift. Alur utamanya:

```text
Operator membuat handover -> draft / submitted
Supervisor review -> approved / rejected
Supervisor reopen -> reopened
Operator edit -> draft / submitted kembali
```

Data utama disimpan di Supabase Postgres. Hampir semua halaman adalah client component yang membaca dan menulis langsung ke Supabase memakai anon key dan RLS. Satu-satunya Route Handler adalah `/api/powerbi/download` untuk mengunduh file `.pbix` khusus supervisor.

Dokumen pendamping:

- `docs/arsitektur-dan-alur-sistem.md` — arsitektur dan alur per halaman.
- `docs/integrasi-power-bi.md` — setup reporting dan Power BI.
- `AGENTS.md` — aturan kerja dan gotcha proyek.

## 2. Prasyarat

- Node.js 20.9 atau lebih baru
- npm
- Akun/proyek Supabase
- Power BI Desktop (opsional, hanya untuk pekerjaan reporting)

## 3. Setup Cepat

```bash
npm install
```

Buat `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Jalankan:

```bash
npm run dev
```

Buka `http://localhost:3000`.

Jangan pernah commit `.env.local`, service role key, password database, file `.pbix`, atau kredensial `powerbi_reader`.

## 4. Perintah Penting

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Development server. |
| `npm run build` | Production build. |
| `npm run start` | Menjalankan hasil build. |
| `npm run lint` | ESLint. Saat ini masih ada error lama di `src/app/(dashboard)/reports/print/page.tsx:52`. |
| `npx tsc --noEmit` | Typecheck tanpa output. |

Sebelum membuat pull request, minimal jalankan:

```bash
npx tsc --noEmit
npm run build
```

## 5. Peta Kode

```text
src/
  app/
    (dashboard)/          Halaman yang memakai Header dan realtime
      dashboard/          Dashboard supervisor (server component)
      handover/           Form, detail, edit, dan print handover
      approvals/          Review dan riwayat approval
      reports/            Daftar laporan dan print
      powerbi/            Halaman download laporan Power BI
      settings/           Admin users dan shifts
    api/powerbi/download/ Route Handler download .pbix
    login/                Login
    forgot-password/      Permintaan reset password
    reset-password/       Reset password
  components/
    header.tsx            Navigasi berdasarkan role + tombol panduan
    guide-modal.tsx       Panduan penggunaan operator/supervisor
    realtime-subscriber.tsx
    handover/             Dokumen handover
    dashboard/            Chart dan komponen dashboard
    ui/                   Komponen UI manual
  contexts/               User, toast, dan confirm provider
  lib/
    handover-types.ts     Tipe dan helper data handover
    supabase/client.ts    Supabase browser client
    supabase/server.ts    Supabase server client
  middleware.ts           Auth dan role guard
supabase/migrations/      Migration SQL manual
public/                   Manifest, service worker, ikon, offline page
powerbi/                  Proyek Power BI PBIP/TMDL
docs/                     Dokumentasi
```

## 6. Auth, Role, dan Akses

Role disimpan di `profiles.role`:

- `operator`
- `supervisor`

Aturan akses utama:

| Halaman | Operator | Supervisor |
|---|---:|---:|
| `/dashboard` | Tidak | Ya |
| `/handover` | Ya | Ya |
| `/approvals` | Ya, data miliknya | Ya, semua data |
| `/reports` | Ya, data miliknya | Ya, semua data |
| `/powerbi` | Tidak | Ya |
| `/settings` | Tidak | Ya |

Middleware melakukan redirect berdasarkan role. RLS tetap menjadi lapisan keamanan utama; jangan mengandalkan pengecekan UI saja.

Untuk membuat user baru:

1. Buat user di Supabase Auth.
2. Pastikan baris `profiles` terbentuk.
3. Set `profiles.role` ke `operator` atau `supervisor`.

## 7. Database dan Migration

Migration berupa file SQL manual:

```text
supabase/migrations/NN_nama_migration.sql
```

Aturan:

- Jalankan berurutan sesuai nomor.
- Jangan mengubah migration yang sudah pernah diterapkan.
- Jangan menjalankan ulang migration `01`-`09` setelah `10`.
- Migration `10_security_rls_audit_indexes.sql` adalah perbaikan RLS dan audit trail.
- Setelah menambah migration, update dokumentasi terkait.

Tabel utama:

- `handovers`
- `handover_activities`
- `profiles`
- `shifts`
- `approvals`
- `tank_products`
- `outstanding_jobs`
- `audit_trail`

Payload operasional disimpan di `handovers.operational_data` (JSONB). Tabel `handover_*` lama adalah legacy dan tidak dipakai aplikasi.

## 8. Siklus Status Handover

Status yang valid:

- `draft`
- `submitted`
- `approved`
- `rejected`
- `reopened`

Aturan bisnis:

- Handover `approved` tidak dapat diedit operator dan tidak dapat dihapus.
- Operator hanya dapat mengedit handover `draft` atau `reopened` miliknya.
- Handover `submitted`, `approved`, atau `rejected` harus di-reopen supervisor sebelum diedit.
- Form pembuatan handover memblokir submit jika masih ada handover aktif berstatus `submitted`, `rejected`, atau `reopened`.
- Submit gate adalah validasi UI, bukan constraint database.
- Approve/reject menulis baris ke `approvals` dan mengisi `approved_at`.
- Reopen mengisi `reopened_at`.

## 9. Cara Mengembangkan

### 9.1 Menambah Field Handover

1. Update tipe dan nilai default di `src/lib/handover-types.ts`.
2. Tambahkan input di `src/app/(dashboard)/handover/page.tsx`.
3. Tambahkan input yang sama di `src/app/(dashboard)/handover/[id]/edit/page.tsx`.
4. Tampilkan field di `src/components/handover/shift-handover-document.tsx`.
5. Jika perlu masuk laporan, update `src/app/(dashboard)/reports/print/page.tsx`.
6. Jika perlu masuk Power BI, tambahkan ke view `reporting` lewat migration baru.
7. Jalankan typecheck dan build.

### 9.2 Menambah Halaman

1. Buat halaman di dalam `src/app/(dashboard)/` agar memakai Header dan layout dashboard.
2. Tambahkan menu di `src/components/header.tsx`.
3. Jika halaman hanya untuk supervisor, tambahkan path ke `supervisorPages` di `src/middleware.ts`.
4. Gunakan `@/lib/supabase/client` untuk halaman client atau `@/lib/supabase/server` untuk server component.
5. Tambahkan loading state dan empty state.
6. Pastikan RLS mendukung query yang dipakai.

### 9.3 Menambah Migration

1. Buat file baru, misalnya `supabase/migrations/17_nama_perubahan.sql`.
2. Tulis SQL yang idempotent bila memungkinkan.
3. Untuk tabel baru, aktifkan RLS dan buat policy minimal.
4. Uji di project staging, bukan langsung di produksi.
5. Update `docs/arsitektur-dan-alur-sistem.md` dan dokumen terkait.

### 9.4 Menambah Role Baru

Role baru bukan perubahan kecil. Diperlukan update di:

- `profiles.role`
- `src/middleware.ts`
- `src/components/header.tsx`
- RLS policy di database
- Dashboard dan halaman terkait

Untuk saat ini, gunakan `operator` atau `supervisor`.

### 9.5 Mengubah Dashboard

Dashboard supervisor adalah server component di `src/app/(dashboard)/dashboard/page.tsx`. Komponen chart ada di `src/components/dashboard/charts.tsx`. Jika menambah query, perhatikan RLS dan performa query.

### 9.6 Power BI

- Panduan lengkap ada di `docs/integrasi-power-bi.md`.
- Schema `reporting` berisi view fakta dan dimensi.
- Role `powerbi_reader` hanya boleh membaca schema `reporting`.
- Jangan memberi akses ke tabel `public`.
- File `.pbix` diunggah ke Supabase Storage private bucket `powerbi` dan diunduh lewat halaman `/powerbi`.

## 10. Konvensi Kode

- UI dan pesan pengguna menggunakan Bahasa Indonesia.
- Gunakan TypeScript strict; hindari `any` jika tidak terpaksa.
- Mutasi dilakukan di client component.
- Setelah mutasi berhasil, tampilkan feedback dengan `useToast`.
- Aksi destruktif memakai `useConfirm`.
- Ikon memakai `lucide-react`.
- Komponen UI berada di `src/components/ui`; tidak memakai Radix atau `components.json`.
- Gunakan `cn` dari `@/lib/utils` untuk menggabungkan className.
- Format tanggal umumnya memakai `toLocaleDateString("id-ID")`.
- Jangan menambahkan komentar yang tidak perlu.

## 11. Checklist Testing Manual

Belum ada automated test suite. Minimal uji alur berikut sebelum deploy:

- Operator dapat membuat draft dan submit.
- Submit kedua diblokir saat masih ada handover aktif.
- Supervisor dapat approve, reject, dan reopen.
- Operator dapat mengedit handover `reopened` miliknya.
- Operator tidak dapat membuka `/dashboard`, `/powerbi`, dan `/settings`.
- Operator hanya melihat handover miliknya di `/reports` dan `/approvals`.
- Handover `approved` tidak dapat dihapus.
- Print handover dan print laporan tampil benar.
- Halaman `/powerbi` dapat mengunduh `.pbix` sebagai supervisor.
- PWA dapat dipasang dan halaman offline muncul saat jaringan terputus.
- Tidak ada error baru di console browser.

## 12. Deployment

1. Deploy ke Vercel atau platform Next.js lain.
2. Set environment variable:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Jalankan migration database berurutan.
4. Pastikan RLS aktif pada semua tabel `public`.
5. Buat user dan atur role di `profiles`.
6. Unggah `ShiftHandover.pbix` ke bucket `powerbi` jika fitur Power BI dipakai.
7. Verifikasi redirect login untuk operator dan supervisor.
8. Verifikasi service worker hanya aktif di production.

## 13. Troubleshooting

| Masalah | Kemungkinan penyebab |
|---|---|
| Query mengembalikan 0 baris | RLS membatasi data; cek policy dan role user. |
| Redirect terus ke login | Cookie sesi tidak terbaca; cek `@supabase/ssr` dan middleware. |
| Operator bisa membuka halaman supervisor | Cek `supervisorPages` di `src/middleware.ts` dan role di `profiles`. |
| Insert handover gagal | Kemungkinan `form_number` duplikat atau policy insert menolak. |
| Submit diblokir | Masih ada handover aktif; cek submit gate. |
| Edit handover `reopened` gagal | Parent harus diubah ke `draft` sebelum activities diubah. |
| Power BI gagal konek | Gunakan session pooler, pasang CA Supabase, dan cek kredensial `powerbi_reader`. |
| File `.pbix` tidak muncul | Pastikan file ada di bucket `powerbi` dan user adalah supervisor. |
| PWA menampilkan versi lama | Unregister service worker atau naikkan versi cache. |

## 14. Technical Debt dan Catatan Keamanan

Beberapa hal yang perlu diperhatikan sebelum production:

- Review dan hardening RLS, terutama policy `profiles`, `handovers`, dan `approvals`.
- Batasi atau nonaktifkan signup publik jika aplikasi hanya untuk pengguna internal.
- Upgrade dependency Next.js ke versi patch terbaru.
- Tambahkan security headers/CSP di `next.config.ts`.
- Pertimbangkan proteksi password bocor di Supabase Auth.
- Tambahkan automated test dan CI.
- Perbaiki error lint lama di halaman print laporan.
- Buat backup database terjadwal dan uji restore.
- Dokumentasikan perubahan schema dan view reporting setiap kali `operational_data` berubah.

## 15. Referensi

- `README.md`
- `AGENTS.md`
- `docs/arsitektur-dan-alur-sistem.md`
- `docs/integrasi-power-bi.md`
- `supabase/migrations/`
