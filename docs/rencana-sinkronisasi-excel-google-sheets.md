# Rencana: Sinkronisasi Supabase → Google Sheets (Excel Online)

> **Status: SELESAI ✅** — view `handover_sync` sudah di-create & terverifikasi via REST API (anon key).
> Tinggal: setup Google Sheets + Apps Script (lihat bagian 4–5).
> Keputusan arsitektur sudah final: **Supabase tetap menjadi database utama**.
> Google Sheets hanya menjadi **cermin satu arah** (readout) untuk kebutuhan client.

---

## 1. Keputusan yang sudah disepakati

| Aspek | Keputusan |
|-------|-----------|
| Platform | **Google Sheets** (paling mudah & gratis untuk client) |
| Keterlambatan | **±1–5 menit** (Apps Script timer, gratis) |
| Arah | **Satu arah**: Supabase → Sheets (edit di Sheets tidak mengubah DB) |
| Pemicu | **Keduanya**: data masuk saat operator *submit* dan kolom status ikut berubah saat *approve/tolak/reopen* |
| Arsitektur DB | Tetap Supabase; Sheets hanya cermin |

## 2. Arsitektur

```
Operator submit / Supervisor approve
            │
            ▼
  Supabase (handovers.updated_at berubah)
            │
            ▼  (dipoll setiap 5 menit)
  Google Apps Script (di dalam file Google Sheets)
            │  REST GET  /rest/v1/handover_sync
            ▼
  Google Sheets — 1 baris per handover (kunci: form_number)
```

- **View `handover_sync`** di Supabase: proyeksi terbatas + join (shift, operator) yang boleh dibaca role `anon` — tidak perlu login/key rahasia di Apps Script.
- **Apps Script** berjalan di server Google (gratis, trigger 5 menit) — tidak perlu deploy aplikasi Next.js.
- Idempoten: upsert berdasarkan `form_number` → tidak pernah ada baris duplikat.

## 3. Langkah 1 — Buat view di Supabase

Jalankan di **Supabase SQL Editor** (project `getdgbyxhohfranaceqd.supabase.co`):

```sql
-- Sekali jalan. View untuk sinkronisasi satu arah ke Google Sheets.
CREATE OR REPLACE VIEW public.handover_sync AS
SELECT
  h.form_number,
  h.tanggal,
  s.name                                      AS shift,
  h.operational_data ->> 'reguShift'          AS regu_shift,
  h.operational_data ->> 'jamShift'           AS jam_shift,
  p.full_name                                 AS operator,
  h.kondisi_operasional,
  h.status,
  h.submitted_at,
  h.approved_at,
  h.catatan,
  h.safety_issue,
  h.kendala,
  h.operational_data #>> '{teams,yangMenyerahkan,danru}' AS menyerahkan_danru,
  h.operational_data #>> '{teams,yangMenerima,danru}'   AS menerima_danru,
  h.operational_data #>> '{teams,mengetahui,spv}'       AS mengetahui_spv,
  h.updated_at
FROM public.handovers h
LEFT JOIN public.shifts s   ON s.id = h.shift_id
LEFT JOIN public.profiles p ON p.id = h.operator_id;

ALTER VIEW public.handover_sync SET (security_invoker = false);

GRANT SELECT ON public.handover_sync TO anon;
```

> ⚠️ **Trade-off keamanan (sudah disetujui):** view ini terbaca oleh role `anon`.
> Hanya kolom terpilih yang terekspos (tanpa akses tulis, tanpa RLS bypass ke tabel lain).
> Untuk project internal, risiko rendah. Upgrade path yang lebih aman ada di bagian 7.

## 4. Langkah 2 — Setup Google Sheets + Apps Script

1. Client membuat **Google Sheets** baru (satu file, beri nama mis. `Logbook Handover`).
2. Tab pertama beri nama `Handovers`.
3. Menu **Extensions → Apps Script**.
4. Tempel kode di bawah, simpan sebagai project (`Ctrl+S`).
5. Ganti **`SUPABASE_ANON_KEY`** dengan anon key project (Supabase Dashboard → Settings → API → anon public key).
6. Di editor Apps Script, jalankan fungsi **`syncHandovers`** sekali → izinkan akses (authorize).
7. Masih di editor, pilih fungsi **`setupTrigger`** → Run → trigger otomatis **setiap 5 menit** dibuat.
8. Tutup editor. Kolom header akan terisi otomatis pada run pertama.

## 5. Kode Apps Script

Tempel ke **Extensions → Apps Script** di file Google Sheets:

```javascript
/**
 * Sinkronisasi satu arah: Supabase → Google Sheets.
 * 1 baris per handover, kunci anti-duplikat = form_number.
 */
const SHEET_NAME = "Handovers";        // nama tab
const MAX_AGE_DAYS = 3;                // ambil handover yang berubah 3 hari terakhir

const SUPABASE_URL = "https://getdgbyxhohfranaceqd.supabase.co";
const SUPABASE_ANON_KEY = "GANTI_DENGAN_ANON_KEY_PROJECT"; // Settings → API → anon public

function syncHandovers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Sheet '" + SHEET_NAME + "' tidak ditemukan.");

  const since = new Date(Date.now() - MAX_AGE_DAYS * 86400000).toISOString();
  const url = SUPABASE_URL + "/rest/v1/handover_sync?select=*&updated_at=gt." + since + "&order=tanggal.desc";

  const res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: { apikey: SUPABASE_ANON_KEY, Accept: "application/json" },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error("Supabase: " + res.getContentText());

  const rows = JSON.parse(res.getContentText());
  if (!rows.length) return;

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(Object.keys(rows[0])); // header otomatis
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // peta form_number → nomor baris (kolom A)
  const existing = {};
  if (sheet.getLastRow() > 1) {
    const values = sheet.getValues().slice(1);
    values.forEach((r, i) => { existing[String(r[0])] = i + 2; });
  }

  rows.forEach((r) => {
    const key = String(r.form_number);
    if (existing[key] !== undefined) {
      const rowNum = existing[key];
      headers.forEach((h, i) => {
        if (h && r[h] !== undefined && r[h] !== null) sheet.getRange(rowNum, i + 1).setValue(r[h]);
      });
    } else {
      sheet.appendRow(headers.map((h) => (r[h] !== undefined ? r[h] : "")));
    }
  });

  SpreadsheetApp.flush();
}

function setupTrigger() {
  // jalankan SEKALI dari editor → trigger tiap 5 menit
  ScriptApp.newTrigger("syncHandovers").timeBased().everyMinutes(5).create();
}
```

## 6. Verifikasi

1. Dari aplikasi, operator submit 1 handover uji.
2. Tunggu ≤5 menit (atau jalankan `syncHandovers` manual di Apps Script) → baris muncul di `Handovers`, status `submitted`.
3. Supervisor approve → tunggu ≤5 menit → kolom status berubah jadi `approved` di baris yang sama.
4. Jalankan `syncHandovers` manual 2x berturut-turut → pastikan **tidak ada duplikat**.

## 7. Upgrade path (nanti, jika diinginkan)

- **Lebih aman tanpa `anon`:** deploy aplikasi ke hosting publik + buat endpoint `/api/sync-sheets` (dijaga token) menggunakan service-role key + Google Service Account. Apps Script cukup memanggil endpoint tersebut. Konsekuensi: perlu deploy + setup Google Cloud Service Account, dan `SUPABASE_SERVICE_ROLE_KEY` disimpan di env server — tidak diperlukan selama memakai pendekatan view `anon`.
- **Sheet kedua "Kegiatan":** jika client ingin log kegiatan per handover, tambahkan view/kolom `aktivitas` (jika satu handover punya banyak kegiatan, cocoknya sheet terpisah dengan kolom `form_number` sebagai kunci).

## 8. Catatan untuk tim

- Kode aplikasi Next.js **tidak perlu diubah** untuk pola ini.
- Kuota Google Apps Script gratis cukup (execution time, URL fetch) untuk trigger 5 menit pada volume 3 handover/hari.
- Jika ada perubahan kolom di view/header, cukup sesuaikan header baris 1 di Sheets — script menyesuaikan otomatis karena header dibaca dari baris 1.