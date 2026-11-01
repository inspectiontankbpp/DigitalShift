# Integrasi Power BI

Dokumen ini menjelaskan integrasi Power BI versi gratis dengan data live dari Supabase. Pendekatan yang dipakai adalah **Power BI Desktop + DirectQuery ke view reporting Supabase**, bukan Power BI Service.

## 1. Ringkasan

| Bagian | Keputusan |
|---|---|
| Tools | Power BI Desktop (gratis, Windows) |
| Mode koneksi | DirectQuery ke PostgreSQL Supabase |
| Sumber data | Schema `reporting`, bukan tabel `public` |
| Akses database | Role read-only `powerbi_reader` |
| Distribusi | File `.pbix` dibagikan lewat OneDrive/SharePoint |
| Data live | Ya, setiap visual DirectQuery membaca database saat dibuka/di-refresh |
| Power BI Service | Tidak dipakai |
| Browser/mobile | Tidak didukung di jalur gratis ini |

Power BI Desktop gratis tidak bisa membagikan laporan live lewat browser. Jika atasan wajib membuka lewat browser atau HP, diperlukan Power BI Pro/Premium atau alternatif dashboard lain.

## 2. Arsitektur

```text
Power BI Desktop (Windows)
  │
  │  DirectQuery + SSL
  ▼
Supabase Postgres
  ├─ schema reporting
  │   ├─ handover_fact
  │   ├─ activity_fact
  │   ├─ approval_fact
  │   ├─ outstanding_job_fact
  │   ├─ tank_level_fact
  │   ├─ qc_fact
  │   ├─ critical_equipment_fact
  │   ├─ safety_tool_fact
  │   └─ transfer_request_fact
  └─ role powerbi_reader (SELECT only)
```

View di schema `reporting` dimiliki oleh `postgres` dan memakai owner rights. Artinya view bisa membaca data `public` tanpa bergantung pada RLS aplikasi, tetapi role `powerbi_reader` sendiri tidak diberi akses ke tabel `public`.

## 3. Object Database

Migration: `supabase/migrations/14_powerbi_reporting.sql` dan migration `15_powerbi_dimensions`.

Yang dibuat:

- Schema `reporting`.
- Role login `powerbi_reader` dengan:
  - `default_transaction_read_only = on`
  - `statement_timeout = 60s`
  - `idle_in_transaction_session_timeout = 60s`
  - hanya `CONNECT` ke database dan `USAGE` schema `reporting`
  - hanya `SELECT` ke view `reporting`
- 9 view fakta + 12 view dimensi.

Jumlah baris saat implementasi:

| View fakta | Baris |
|---|---:|
| `reporting.handover_fact` | 11 |
| `reporting.activity_fact` | 21 |
| `reporting.approval_fact` | 27 |
| `reporting.outstanding_job_fact` | 0 |
| `reporting.tank_level_fact` | 13 |
| `reporting.qc_fact` | 4 |
| `reporting.critical_equipment_fact` | 143 |
| `reporting.safety_tool_fact` | 88 |
| `reporting.transfer_request_fact` | 4 |

| View dimensi | Baris |
|---|---:|
| `reporting.dim_date` | 444 |
| `reporting.dim_operator` | 2 |
| `reporting.dim_supervisor` | 2 |
| `reporting.dim_shift` | 4 |
| `reporting.dim_regu` | 5 |
| `reporting.dim_handover_status` | 5 |
| `reporting.dim_approval_status` | 2 |
| `reporting.dim_activity_status` | 4 |
| `reporting.dim_job_status` | 4 |
| `reporting.dim_priority` | 4 |
| `reporting.dim_product` | 8 |
| `reporting.dim_tank` | 14 |

Catatan: `tank_level_fact` dapat berisi baris dengan `no_tanki` kosong jika ada entry tank level kosong di JSON. Untuk visual tank, tambahkan filter `no_tanki is not null`.

## 4. Keamanan

- Jangan memakai `service_role` atau anon key untuk Power BI.
- `powerbi_reader` hanya bisa membaca view `reporting`; akses ke `public.handovers` dan `public.profiles` sudah diverifikasi `false`.
- Role bersifat read-only di level session. Write akan gagal walaupun query mencoba `INSERT/UPDATE/DELETE`.
- Password role **tidak** disimpan di repository. Set password secara manual:

```sql
alter role powerbi_reader with password '<password-kuat>';
```

- Simpan password di password manager. Rotasi setelah pergantian personel atau jika file kredensial bocor.
- File `.pbix` biasanya menyimpan kredensial di Windows Credential Manager, bukan di file. Tetap perlakukan `.pbix` sebagai dokumen internal.
- Jangan commit file kredensial ke Git.

## 5. Koneksi dari Power BI Desktop

### 5.1 Prasyarat

- Windows 10/11.
- Power BI Desktop terbaru.
- Akses jaringan ke host database Supabase.
- Kredensial `powerbi_reader`.
- **CA Supabase terpasang di Trusted Root Windows.**

**Wajib: CA Supabase.** Power BI Desktop memvalidasi sertifikat PostgreSQL. Supabase memakai CA self-signed (`Supabase Root 2021 CA`), jadi tanpa CA akan muncul error `The remote certificate is invalid according to the validation procedure`. Download `prod-ca-2021.crt` dari Supabase Dashboard > **Database Settings** > **SSL Configuration**, lalu import ke `Cert:\CurrentUser\Root`:

```powershell
Import-Certificate -FilePath .\prod-ca-2021.crt -CertStoreLocation Cert:\CurrentUser\Root
```

Jika muncul `UI is not allowed in this operation`, import lewat .NET `X509Store` atau `certutil -addstore -user Root`. Restart Power BI Desktop setelah import.

### 5.2 Langkah koneksi

1. Buka Power BI Desktop.
2. Pilih **Get Data** → **Database** → **PostgreSQL database**.
3. Isi:
   - **Server**: `<project-ref>.pooler.supabase.com`
   - **Database**: `postgres`
   - Jika dialog meminta port, isi `5432` atau tulis server sebagai `<project-ref>.pooler.supabase.com:5432`.
4. Pilih **DirectQuery**.
5. Klik **OK**.
6. Saat diminta kredensial:
   - **User name**: `powerbi_reader.<project-ref>`
   - **Password**: password yang sudah diset.
7. Jika muncul pilihan SSL, gunakan koneksi terenkripsi/`Require`.
8. Di Navigator, pilih schema `reporting` dan view yang dibutuhkan.
9. Klik **Load**.

### 5.3 Catatan koneksi

Direct host `db.<project-ref>.supabase.co` hanya punya record IPv6. Pada jaringan tanpa IPv6, koneksi langsung gagal. Gunakan **Session pooler**:

- Host: `<project-ref>.pooler.supabase.com`
- Port: `5432`
- User: `powerbi_reader.<project-ref>`
- Database: `postgres`
- SSL: `require`

Ganti `<project-ref>` dengan project ref Supabase Anda. Jangan commit password atau file kredensial.

Koneksi pooler di atas sudah diuji dan berhasil membaca `reporting.handover_fact`. Jangan memakai **Transaction pooler** (port `6543`) untuk DirectQuery Power BI.

Jika project dipindahkan region atau connection string berubah, salin ulang dari Supabase Dashboard → **Project Settings** → **Database**.

### 5.4 Proyek PBIP siap pakai

Folder `powerbi/` sudah berisi proyek PBIP yang dibuat untuk schema `reporting`:

- `ShiftHandover.pbip` — buka file ini di Power BI Desktop.
- `ShiftHandover.SemanticModel/` — model DirectQuery dengan 12 dimensi, 9 fact, 45 relasi, dan 41 measure.
- `ShiftHandover.Report/` — laporan PBIR dengan 3 halaman dan 35 visual:
  - **Ringkasan Operasional** — KPI, tren handover, status, shift, tabel handover terbaru.
  - **Approval & Kepatuhan** — approval rate, waktu keputusan, approval per supervisor, riwayat keputusan.
  - **Aset & Keselamatan** — critical equipment, safety tool, level tank, permintaan transfer.

Saat pertama membuka, Power BI Desktop akan meminta kredensial PostgreSQL. Gunakan kredensial `powerbi_reader` di atas, lalu refresh. Setelah tampilan sesuai, simpan sebagai `.pbix` untuk dibagikan.

Validasi yang sudah dilakukan: schema PBIP/PBIR 44 file tanpa error, TMDL berhasil di-import dan diekspor ulang oleh Power BI Modeling MCP tanpa perubahan, serta 61 referensi field di 35 visual cocok dengan model.

## 6. Model Data yang Disarankan

### 6.1 Tabel fakta

Gunakan view berikut sebagai tabel:

- `handover_fact` — tabel utama untuk hampir semua visual.
- `approval_fact` — analisis approval dan SLA.
- `outstanding_job_fact` — pekerjaan terbuka.
- `tank_level_fact` — level tank dan produk.
- `qc_fact` — kualitas produk.
- `critical_equipment_fact` — kondisi peralatan kritikal.
- `safety_tool_fact` — kondisi alat safety.
- `transfer_request_fact` — rencana transfer.
- `activity_fact` — log aktivitas.

### 6.2 Relasi

Buat relasi:

- `handover_fact[handover_id]` 1 → * `approval_fact[handover_id]`
- `handover_fact[handover_id]` 1 → * `activity_fact[handover_id]`
- `handover_fact[handover_id]` 1 → * `outstanding_job_fact[handover_id]`
- `handover_fact[handover_id]` 1 → * `tank_level_fact[handover_id]`
- `handover_fact[handover_id]` 1 → * `qc_fact[handover_id]`
- `handover_fact[handover_id]` 1 → * `critical_equipment_fact[handover_id]`
- `handover_fact[handover_id]` 1 → * `safety_tool_fact[handover_id]`
- `handover_fact[handover_id]` 1 → * `transfer_request_fact[handover_id]`

Arah filter: satu arah dari `handover_fact` ke tabel fakta lain.

### 6.3 Tabel tanggal

Buat calculated table:

```dax
DimTanggal =
CALENDAR(
    DATE(2024, 1, 1),
    TODAY() + 365
)
```

Tambahkan kolom:

```dax
Tahun = YEAR(DimTanggal[Date])
Bulan = FORMAT(DimTanggal[Date], "MMMM")
BulanAngka = MONTH(DimTanggal[Date])
Hari = FORMAT(DimTanggal[Date], "dddd")
```

Relasikan `DimTanggal[Date]` 1 → * `handover_fact[tanggal_operasional]`.

## 7. Measures DAX

Semua 41 measure sudah tertanam di semantic model `powerbi/ShiftHandover.SemanticModel`. Daftar lengkap ada di `powerbi/measures.dax`; file itu dihasilkan dari model dan tidak perlu copy-paste jika memakai PBIP.

Contoh measure utama:

```dax
Total Handover =
COUNTROWS ( HandoverFact )

Approval Rate =
DIVIDE ( [Handover Approved], [Total Handover] )

Critical Equipment Issue Rate =
DIVIDE ( [Critical Equipment Issue], [Total Critical Equipment] )

Rata-rata Level Tank (mm) =
CALCULATE (
    AVERAGE ( TankLevelFact[level_mm] ),
    TankLevelFact[no_tanki_normalized] <> BLANK ()
)
```

## 8. Saran Halaman Laporan

PBIP yang sudah ada memakai tiga halaman pertama. Halaman 4–6 adalah saran pengembangan berikutnya.

### Halaman 1 — Ringkasan Operasional

- KPI: Total Handover, Approved, Pending, Approval Rate, Reopen Rate.
- Tren handover per hari/bulan.
- Distribusi status.
- Handover per shift/regu.
- Tabel 5 handover terbaru.

### Halaman 2 — Approval & Kepatuhan

- Avg Decision Minutes/Hours.
- SLA 60 menit.
- Tren waktu approval.
- Tabel approval lambat.
- Distribusi supervisor.

### Halaman 3 — Aset & Keselamatan

- Safety Issue Rate.
- Critical Equipment Issue Rate.
- Safety Tool Issue Rate.
- Kendala dan safety issue terbaru.
- Tabel equipment/tool bermasalah.
- QC density/temperature.

### Halaman 4 — Outstanding Jobs

- Open Jobs, Overdue Jobs.
- Aging job.
- Job per PIC/prioritas.
- Tabel job terbuka.

### Halaman 5 — Tank & Produk

- Level tank per produk.
- Water level.
- Tren level tank.
- Tabel tank terbaru.
- Filter `no_tanki is not null`.

### Halaman 6 — Detail Handover

- Tabel detail handover.
- Drill-through dari halaman lain.
- Filter tanggal, shift, regu, status, operator.

## 9. Distribusi ke Atasan

1. Simpan `.pbix` di folder OneDrive/SharePoint yang di-share.
2. Atasan membuka file dengan Power BI Desktop.
3. Karena DirectQuery, data akan live saat visual dimuat.
4. Jika atasan hanya butuh melihat, ekspor PDF dari Power BI Desktop atau cetak halaman aplikasi.
5. Jangan mengandalkan Power BI Service gratis untuk sharing live di browser.

### 9.1 Distribusi lewat aplikasi

Supervisor juga bisa mengunduh file dari aplikasi:

1. Simpan file hasil **Save As** dari Power BI Desktop.
2. Unggah file ke Supabase Dashboard > Storage > bucket private `powerbi` dengan nama `ShiftHandover.pbix`. Bucket dan policy baca supervisor dibuat oleh `supabase/migrations/16_powerbi_storage.sql`.
3. Buka menu **Power BI** di aplikasi (hanya muncul untuk supervisor).
4. Klik **Download .pbix**. Route `/api/powerbi/download` memeriksa sesi dan role supervisor, lalu mengambil file dari Supabase Storage.
5. File `.pbix` tidak di-commit ke repository. Bucket bersifat private dan hanya supervisor yang punya policy baca.
6. Jika file belum ada, halaman menampilkan status **Belum tersedia**. File tetap memakai DirectQuery, jadi data mengikuti database saat dibuka.

## 10. Keterbatasan

- Power BI Desktop gratis hanya Windows.
- Tidak ada akses browser/mobile untuk laporan live.
- DirectQuery membutuhkan koneksi database setiap kali laporan dibuka.
- Performa tergantung kualitas view dan koneksi jaringan.
- Tidak ada scheduled refresh karena DirectQuery membaca langsung.
- Perubahan schema view harus dikoordinasikan agar laporan tidak rusak.
- Password role harus dirotasi dan tidak boleh dibagikan lewat chat/repo.

## 11. Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `permission denied for schema reporting` | Grant belum ada | Jalankan grant di migration atau cek `has_schema_privilege` |
| `password authentication failed` | Password salah/belum diset | Set ulang password `powerbi_reader` |
| `could not connect to server` | Host/port salah atau IPv6 | Pakai session pooler dari dashboard |
| `SSL required` | Server meminta SSL | Aktifkan encrypted connection/`sslmode=require` |
| Visual kosong | Filter terlalu ketat | Cek data di view dengan SQL |
| `no_tanki` kosong | Entry tank kosong | Filter `no_tanki is not null` |
| Approval time aneh | Data lama/timestamp tidak konsisten | Cek `decision_minutes` dan data sumber |
| Power BI lambat | DirectQuery + view berat | Batasi visual, filter tanggal, optimasi view |

## 12. Maintenance

- Jika ada perubahan struktur `operational_data`, update view di migration baru.
- Setelah update view, jalankan:

```sql
grant select on all tables in schema reporting to powerbi_reader;
```

- Verifikasi akses:

```sql
select
  has_schema_privilege('powerbi_reader', 'reporting', 'USAGE') as can_use_reporting,
  has_table_privilege('powerbi_reader', 'reporting.handover_fact', 'SELECT') as can_select_view,
  has_table_privilege('powerbi_reader', 'public.handovers', 'SELECT') as can_select_public;
```

Hasil yang diharapkan: `true, true, false`.

- Rotasi password:

```sql
alter role powerbi_reader with password '<password-baru>';
```

- Jangan menambahkan grant ke tabel `public` untuk `powerbi_reader`.

## 13. Catatan Data Quality

Saat implementasi, data masih memiliki beberapa keterbatasan:

- Semua 11 handover berstatus `approved`.
- Belum ada komentar approval.
- Belum ada outstanding job.
- Hanya 5 handover memiliki data tank level.
- Hanya 2 handover memiliki data QC.
- Satuan level tank campuran (`400`, `400 mm`, `7016 mm`).
- `shift_name` dan `regu_shift` belum selalu konsisten (mis. `Pagi` vs `regu3`).
- Belum ada data kendala/safety issue/catatan yang terisi.

Visual Power BI tetap bisa dibuat, tetapi insight akan terbatas sampai data operasional lebih lengkap.
