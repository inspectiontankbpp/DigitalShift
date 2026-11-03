# Power BI Assets

Folder ini berisi proyek Power BI berbasis PBIP/TMDL dan aset pendukung.

- `ShiftHandover.pbip` — shortcut proyek untuk dibuka di Power BI Desktop.
- `ShiftHandover.SemanticModel/` — model DirectQuery: 12 dimensi, 9 fact, 45 relasi, 41 measure.
- `ShiftHandover.Report/` — laporan PBIR: 3 halaman, 35 visual.
- `measures.dax` — daftar 41 measure DAX yang dihasilkan dari semantic model.
- Panduan lengkap: `../docs/integrasi-power-bi.md`.

## Prasyarat TLS (wajib)

Power BI Desktop memvalidasi sertifikat PostgreSQL. Supabase memakai CA self-signed, sehingga koneksi gagal dengan error `The remote certificate is invalid according to the validation procedure` jika CA belum dipercaya Windows.

1. Download `prod-ca-2021.crt` dari Supabase Dashboard > Database Settings > SSL Configuration.
2. Import ke Trusted Root Current User:
   ```powershell
   Import-Certificate -FilePath .\prod-ca-2021.crt -CertStoreLocation Cert:\CurrentUser\Root
   ```
   Jika muncul `UI is not allowed in this operation`, import lewat .NET `X509Store` atau `certutil -addstore -user Root`.
3. Restart Power BI Desktop sebelum refresh.

## Membuka proyek PBIP

1. Install Power BI Desktop (Windows).
2. Install CA Supabase seperti pada bagian **Prasyarat TLS**.
3. Buka `ShiftHandover.pbip`.
4. Saat diminta kredensial PostgreSQL, gunakan:
   - Server: `<pooler-host>` (contoh: `aws-0-ap-northeast-1.pooler.supabase.com`)
   - Port: `5432`
   - Database: `postgres`
   - User: `powerbi_reader.<project-ref>`
   - Password: dari password manager.
5. Pastikan mode koneksi DirectQuery dan schema `reporting`.
6. Ganti `<pooler-host>` dengan host session pooler dari Dashboard dan `<project-ref>` dengan project ref Supabase Anda. Jangan simpan password di repo.
7. Refresh, cek visual, lalu simpan sebagai `.pbix` di OneDrive/SharePoint.

Untuk menu download di aplikasi, unggah file ke Supabase Storage private bucket `powerbi` dengan nama `ShiftHandover.pbix`. Route `/api/powerbi/download` mengambil file dari Storage dan hanya mengizinkan supervisor.

Halaman laporan: **Ringkasan Operasional**, **Approval & Kepatuhan**, **Aset & Keselamatan**.

## Validasi yang sudah dilakukan

- Schema PBIP/PBIR: 44 file JSON, 0 error.
- TMDL: berhasil di-import ulang oleh Power BI Modeling MCP dan diekspor ulang tanpa perubahan.
- Referensi laporan: 35 visual, 61 field, semuanya cocok dengan tabel/kolom/measure di model.

Catatan: gunakan session pooler di atas karena direct host hanya IPv6. Jangan memakai transaction pooler port `6543` untuk DirectQuery.

Jangan menyimpan password atau file kredensial di folder ini.
