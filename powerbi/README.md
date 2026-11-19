# Power BI Assets

Folder ini berisi proyek Power BI berbasis PBIP/TMDL dan aset pendukung.

- `ShiftHandover.pbip` — shortcut proyek untuk dibuka di Power BI Desktop.
- `ShiftHandover.SemanticModel/` — model DirectQuery: 12 dimensi, 10 fact, 51 relasi, 44 measure.
- `ShiftHandover.Report/` — laporan PBIR: 4 halaman, 43 visual.
- `measures.dax` — daftar 44 measure DAX yang dihasilkan dari semantic model.
- Panduan lengkap: `../docs/integrasi-power-bi.md`.

## Alur singkat

- **Supervisor:** buka menu **Power BI** di aplikasi → **Download .pbix** → buka di Power BI Desktop → **Refresh**.
- **Admin:** buka `ShiftHandover.pbip` → **Refresh** → **Save As** `.pbix` → upload ke bucket private `powerbi` dengan nama `ShiftHandover.pbix`.

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
   - Server: `aws-0-ap-northeast-1.pooler.supabase.com`
   - Port: `5432`
   - Database: `postgres`
   - User: `powerbi_reader.getdgbyxhohfranaceqd`
   - Password: minta admin atau lihat password manager. Jangan simpan di repo.
5. Pastikan mode koneksi DirectQuery dan schema `reporting`.
6. Refresh, cek visual, lalu simpan sebagai `.pbix` di OneDrive/SharePoint.

Untuk menu download di aplikasi, unggah file ke Supabase Storage private bucket `powerbi` dengan nama `ShiftHandover.pbix`. Route `/api/powerbi/download` mengambil file dari Storage dan hanya mengizinkan supervisor.

Halaman laporan: **Ringkasan Operasional**, **Tangki Penerimaan**, **Approval & Kepatuhan**, **Aset & Keselamatan**.

## Validasi yang sudah dilakukan

- Schema PBIP/PBIR: seluruh file JSON valid, 0 error.
- TMDL: berhasil di-import ulang oleh Power BI Modeling MCP dan diekspor ulang tanpa perubahan.
- Referensi laporan: 43 visual, semuanya cocok dengan tabel/kolom/measure di model.

Catatan: gunakan session pooler di atas karena direct host hanya IPv6. Jangan memakai transaction pooler port `6543` untuk DirectQuery.

## Troubleshooting refresh

### `EMAXCONNSESSION max clients reached ... pool_size: 15`

DirectQuery membuka satu sesi per tabel. Model ini punya 22 tabel, sedangkan
session pooler Supabase membatasi client (default `pool_size` 15).

Model sekarang memakai shared expression `SupabasePostgres` di `model.tmdl`.
Semua partisi memakai `Source = SupabasePostgres`, sehingga Power BI melihatnya
sebagai **satu data source** (bukan 22). Jika menambah tabel baru, jangan buat
`PostgreSQL.Database(...)` baru; gunakan `Source = SupabasePostgres`.

Langkah tambahan jika masih gagal:

1. Di Power BI Desktop: **File > Options and settings > Options > Current File >
   DirectQuery**, set **Maximum connections per data source** ke `1`.
2. Di **Current File > Data Load**, nonaktifkan **Enable parallel loading of
   tables**.
3. Refresh ulang.

Alternatif: naikkan **Pool size** di Supabase Dashboard > Database > Settings
(jaga tetap di bawah `max_connections` Postgres), atau ubah model ke **Import
mode** karena volume data kecil.

### `A cyclic reference was encountered during evaluation`

Penyebab: dimensi (`dim_date`, `dim_product`, `dim_tank`) dibangun dari fact
view yang berelasi balik ke dimensi tersebut. Migration 23 sudah memisahkan
dimensi dari fact view. Terapkan migration 23, buka ulang PBIP, lalu refresh.

Jangan menyimpan password atau file kredensial di folder ini.
