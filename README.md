# Digital Shift Handover & Operation Logbook

PWA internal untuk serah terima shift dan logbook operasional. Antarmuka menggunakan Bahasa Indonesia. Operator membuat dan mengirim handover; supervisor meninjau, menyetujui, menolak, atau membuka kembali handover.

## Fitur

- Autentikasi Supabase dengan role `operator` dan `supervisor`.
- Form handover dengan nomor unik `SH-YYYYMMDD-NNN`.
- Status handover: `draft`, `submitted`, `approved`, `rejected`, dan `reopened`.
- Data operasional: level tangki, QC, peralatan kritis, alat keselamatan, permintaan transfer, dan tim shift.
- Activity log per handover, termasuk sub-item aktivitas.
- Approval dan reopen oleh supervisor.
- Laporan dan ekspor CSV/PDF.
- Halaman cetak handover dan laporan.
- Pengaturan master data: users, shifts, dan tanks.
- Dashboard ringkasan operasional.
- Unduhan laporan Power BI (`.pbix`) khusus supervisor.
- PWA dengan service worker dan halaman offline.
- Keep-alive Supabase melalui endpoint read-only untuk mencegah project pause.

## Peran dan akses

| Peran | Akses utama |
| --- | --- |
| `operator` | Membuat, mengubah, dan mengirim handover; membuka halaman laporan. |
| `supervisor` | Melihat seluruh handover, approval/reject/reopen, dashboard, settings, dan Power BI. |

Operator diarahkan keluar dari `/dashboard`, `/powerbi`, dan `/settings`. Halaman `/reports` dapat dibuka operator; cakupan data yang terlihat mengikuti policy RLS yang aktif. Temuan terkait RLS ada di [`docs/audit-keamanan-dan-integritas-database.md`](docs/audit-keamanan-dan-integritas-database.md).

## Alur status handover

```text
draft ──submit──> submitted ──approve──> approved
                     │
                     └──reject──> rejected
                                      │
                              reopen ─┘
                                      ▼
                                  reopened ──edit/submit──> submitted
```

Handover yang sudah `submitted`, `approved`, atau `rejected` tidak dapat diedit operator sampai supervisor melakukan reopen. Handover `approved` tidak dapat dihapus.

## Teknologi

- Next.js 16 App Router + React 19
- TypeScript strict
- Tailwind CSS v4
- Supabase: Auth, Postgres, Storage, dan Realtime
- `@supabase/ssr` untuk autentikasi berbasis cookie
- `lucide-react` untuk ikon
- `jspdf` dan `jszip` untuk ekspor laporan
- PWA: `public/manifest.json`, `public/sw.js`, dan `public/offline.html`

## Struktur proyek

```text
src/
  app/
    (dashboard)/        Halaman setelah login: dashboard, handover, approvals,
                        reports, settings, powerbi
    api/powerbi/        Route Handler unduhan file .pbix
    login/              Login
    forgot-password/    Permintaan reset password
    reset-password/     Reset password
  components/           Header, guide, PWA, realtime, UI primitives
  lib/                  Supabase client/server, tipe handover, PDF, utils
supabase/
  migrations/           Migrasi SQL manual, diterapkan berurutan
powerbi/
  ShiftHandover.*       Proyek PBIP/TMDL siap dibuka di Power BI Desktop
docs/
  arsitektur-dan-alur-sistem.md
  integrasi-power-bi.md
  keep-alive-supabase.md
  panduan-developer.md
  audit-keamanan-dan-integritas-database.md
public/                 Manifest, service worker, offline page, aset
```

## Menjalankan secara lokal

Prasyarat: Node.js 20.9 atau lebih baru, npm, dan project Supabase.

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

Buat `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

`.env.local` tidak boleh di-commit. Jangan pernah menaruh `service_role` key, password database, atau kredensial Power BI di source code.

## Perintah

```bash
npm run dev          # development server di localhost:3000
npm run build        # production build
npm run start        # menjalankan hasil build
npm run lint         # ESLint
npx tsc --noEmit     # typecheck
```

Saat ini belum ada test otomatis, CI, atau pre-commit hook.

## Database dan migrasi

Data utama:

- `profiles`: profil pengguna dan role (`operator` / `supervisor`).
- `handovers`: header handover, status, nomor form, dan `operational_data` JSONB.
- `handover_activities`: baris aktivitas handover.
- `approvals`: riwayat approve/reject.
- `outstanding_jobs`: pekerjaan outstanding untuk dashboard.
- `tank_products`: master nomor tangki dan produk.
- `shifts`: master nama shift.
- `audit_trail`: audit perubahan handover yang ditulis oleh trigger database.

Seluruh payload operasional (tangki, QC, peralatan kritis, alat keselamatan, transfer, tim) disimpan di `handovers.operational_data`. Tipe TypeScript-nya ada di `src/lib/handover-types.ts`.

Migrasi berada di `supabase/migrations/NN_*.sql` dan diterapkan manual secara berurutan. Jangan mengulang migrasi `01`–`09` setelah migrasi `10`: migrasi awal memakai RLS yang permissive, sedangkan `10_security_rls_audit_indexes.sql` adalah perbaikan keamanannya. Setelah membuat view baru di schema `public`, cabut privilege default dan berikan hanya privilege yang dibutuhkan.

## Power BI

Layer reporting menggunakan schema `reporting` dan role read-only `powerbi_reader`. Proyek PBIP/TMDL ada di `powerbi/`; file `.pbix` disimpan di bucket private `powerbi` dan hanya dapat diunduh supervisor melalui halaman `/powerbi`.

Halaman `/powerbi` tidak menampilkan kredensial database. Kredensial `powerbi_reader` dibagikan melalui password manager dan tidak boleh di-hardcode di source. Detail setup ada di [`docs/integrasi-power-bi.md`](docs/integrasi-power-bi.md).

## Keep-alive Supabase

Migrasi `17` dan `18` membuat view read-only `public.keep_alive_ping`. Monitor uptime eksternal memanggil:

```text
GET /rest/v1/keep_alive_ping?select=pinged_at
```

Gunakan anon key, bukan `service_role`. Detail ada di [`docs/keep-alive-supabase.md`](docs/keep-alive-supabase.md).

## Deployment

Aplikasi dapat di-deploy ke Vercel atau platform Next.js lainnya. Set environment variable `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` di platform deployment. Service worker hanya didaftarkan pada production build.

## Dokumentasi tambahan

- [`docs/arsitektur-dan-alur-sistem.md`](docs/arsitektur-dan-alur-sistem.md) — arsitektur, alur halaman, dan aturan bisnis.
- [`docs/integrasi-power-bi.md`](docs/integrasi-power-bi.md) — schema reporting, role read-only, dan koneksi Power BI.
- [`docs/keep-alive-supabase.md`](docs/keep-alive-supabase.md) — konfigurasi uptime monitor.
- [`docs/panduan-developer.md`](docs/panduan-developer.md) — panduan pengembangan dan maintenance.
- [`docs/audit-keamanan-dan-integritas-database.md`](docs/audit-keamanan-dan-integritas-database.md) — temuan audit keamanan dan integritas database.
