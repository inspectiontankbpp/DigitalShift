/**
 * Sinkronisasi satu arah: Supabase → Google Sheets.
 * 1 baris per handover, kunci anti-duplikat = form_number.
 *
 * Setup:
 *   1. Buat Google Sheet baru → tab bernama "Handovers"
 *   2. Extensions → Apps Script → tempel kode ini → Save
 *   3. Ganti SUPABASE_ANON_KEY dengan key project Anda
 *   4. Run setupTrigger() SEKALI untuk membuat timer 5 menit
 */
const SHEET_NAME = "Handovers";
const MAX_AGE_DAYS = 3;
const SUPABASE_URL = "https://getdgbyxhohfranaceqd.supabase.co";
const SUPABASE_ANON_KEY = "GANTI_DENGAN_ANON_KEY_PROJECT";

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

  if (sheet.getLastRow() === 0) sheet.appendRow(Object.keys(rows[0]));

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const existing = {};
  if (sheet.getLastRow() > 1) {
    sheet.getValues().slice(1).forEach((r, i) => { existing[String(r[0])] = i + 2; });
  }

  rows.forEach(function(r) {
    const key = String(r.form_number);
    if (existing[key] !== undefined) {
      const rowNum = existing[key];
      headers.forEach(function(h, i) {
        if (h && r[h] !== undefined && r[h] !== null) sheet.getRange(rowNum, i + 1).setValue(r[h]);
      });
    } else {
      sheet.appendRow(headers.map(function(h) { return r[h] !== undefined ? r[h] : ""; }));
    }
  });

  SpreadsheetApp.flush();
}

function setupTrigger() {
  ScriptApp.newTrigger("syncHandovers").timeBased().everyMinutes(5).create();
}
