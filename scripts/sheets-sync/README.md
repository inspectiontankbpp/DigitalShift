# Sinkronisasi Supabase → Google Sheets

## Langkah 1 — View di Supabase

Jalankan file `supabase/migrations/09_handover_sync_view.sql` di Supabase SQL Editor.

## Langkah 2 — Setup Google Sheets

1. Buat Google Sheet baru → tab bernama `Handovers`
2. Extensions → Apps Script → tempel isi `Code.gs` → Save
3. Ganti `SUPABASE_ANON_KEY` dengan key project
4. Run `syncHandovers()` sekali → authorize
5. Run `setupTrigger()` sekali → timer 5 menit aktif
