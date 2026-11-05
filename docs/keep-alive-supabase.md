# Cegah Pause Supabase Free dengan Keep-Alive

Supabase Free mem-pause project setelah **7 hari tanpa aktivitas database**. Dokumen ini menjelaskan mekanisme keep-alive yang dipakai aplikasi: satu view read-only di Supabase yang dipanggil oleh uptime monitor eksternal.

Tidak ada cron, tidak ada daemon, dan tidak memakai Vercel Function.

## Arsitektur

```text
UptimeRobot / Better Stack
        |
        | GET tiap 6 jam
        v
Supabase REST: /rest/v1/keep_alive_ping?select=pinged_at
        |
        v
SELECT now()
```

Monitor memanggil Supabase langsung, bukan lewat aplikasi Vercel. Ini tetap bekerja walau deployment Vercel sedang down dan tidak memakai kuota Vercel.

## Object Database

Migration `17_keep_alive.sql` membuat view:

```sql
create or replace view public.keep_alive_ping
with (security_invoker = true) as
select now() as pinged_at;
```

Migration `18_keep_alive_harden.sql` memastikan privilege hanya `SELECT`:

```sql
revoke all on public.keep_alive_ping from public;
revoke all on public.keep_alive_ping from anon, authenticated, service_role;
grant select on public.keep_alive_ping to anon, authenticated, service_role;
```

View ini tidak menyimpan row, tidak membuka data handover/user, dan tidak bisa dipakai untuk insert/update/delete.

## Setup Uptime Monitor

Gunakan UptimeRobot, Better Stack, atau layanan sejenis.

1. Buat monitor HTTP(S).
2. URL:

   ```text
   https://<project-ref>.supabase.co/rest/v1/keep_alive_ping?select=pinged_at
   ```

3. Method: `GET`.
4. Tambahkan header:

   ```text
   apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>
   Authorization: Bearer <NEXT_PUBLIC_SUPABASE_ANON_KEY>
   ```

5. Interval: **6 jam** jika tersedia. Kalau tidak, 1 jam juga aman. Bahkan sekali sehari sudah cukup karena ambang pause adalah 7 hari.
6. Expected response: HTTP `200` dengan body seperti:

   ```json
   [{"pinged_at":"2026-11-04T13:09:19.598618+00:00"}]
   ```

7. Aktifkan alert email/WhatsApp/Telegram agar tahu kalau Supabase pause atau endpoint bermasalah.

Untuk redundansi tanpa server, buat monitor kedua di provider berbeda ke URL yang sama.

## Verifikasi Manual

PowerShell:

```powershell
$url = "https://<project-ref>.supabase.co"
$key = "<NEXT_PUBLIC_SUPABASE_ANON_KEY>"

Invoke-RestMethod `
  -Uri "$url/rest/v1/keep_alive_ping?select=pinged_at" `
  -Headers @{ apikey = $key; Authorization = "Bearer $key" } `
  -Method Get
```

curl:

```bash
curl -s "https://<project-ref>.supabase.co/rest/v1/keep_alive_ping?select=pinged_at" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Cek langsung di SQL Editor:

```sql
select * from public.keep_alive_ping;
```

## Keamanan

- Anon key memang publik karena dipakai frontend; endpoint ini hanya mengembalikan timestamp.
- Jangan memakai `service_role` key di uptime monitor.
- View hanya punya privilege `SELECT`. Insert/update/delete sudah dicabut.
- `security_invoker = true` membuat view mengikuti privilege role pemanggil, bukan owner.
- Tidak ada data bisnis yang terekspos.

## Dampak Kuota

- Tidak ada row baru, jadi tidak menambah ukuran database.
- Ping 6 jam = 4 request/hari atau sekitar 120 request/bulan.
- Respons sangat kecil; bandwidth jauh di bawah kuota Supabase Free.
- Tidak memakai kuota Vercel karena monitor memanggil Supabase langsung.

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| `404` | Schema cache PostgREST belum reload | Jalankan `notify pgrst, 'reload schema';` atau tunggu beberapa detik |
| `401` / `403` | Header `apikey`/`Authorization` salah | Pastikan memakai anon key yang sama dengan `.env.local` |
| `500` saat POST | View memang read-only | Normal; gunakan `GET` |
| Monitor gagal terus | Project sudah pause | Restore manual dari dashboard Supabase |
| Ping sukses tapi tetap pause | Aktivitas dianggap tidak cukup | Pastikan monitor benar-benar `GET` ke Supabase, bukan ke halaman lain |

## Batasan

- Hanya mencegah pause karena **inactivity**.
- Tidak mencegah pause karena kuota, billing, atau pelanggaran kebijakan.
- Kalau project sudah pause, keep-alive tidak bisa membangunkan; restore tetap manual.
- Monitor eksternal tetap sebuah layanan terjadwal, tetapi bukan cron di repo dan tidak bergantung pada Vercel.
