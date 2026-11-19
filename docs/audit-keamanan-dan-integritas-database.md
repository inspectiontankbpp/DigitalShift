# Audit Keamanan dan Integritas Database

Dokumen ini merangkum hasil audit database Supabase pada aplikasi Digital Shift Handover. Audit dilakukan secara **read-only**; tidak ada perubahan schema, policy, data, atau konfigurasi yang dilakukan saat audit.

- **Tanggal audit:** 30 Oktober 2026
- **Lingkup:** schema `public`, RLS, function/trigger, foreign key, constraint, data saat ini, konfigurasi Auth, dan alur mutasi approval di aplikasi.
- **Metode:** query SQL read-only, Supabase security/performance advisors, pemeriksaan `pg_policies`, `pg_proc`, `pg_trigger`, `pg_constraint`, pengecekan data, serta review kode mutasi approval.
- **Status:** temuan belum diperbaiki.

## 1. Ringkasan Eksekutif

Audit menemukan **5 temuan kritis**, **9 temuan tinggi**, dan beberapa temuan sedang/rendah. Risiko terbesar bukan pada UI, tetapi pada kombinasi RLS yang terlalu longgar dan function Auth yang mempercayai metadata user.

Risiko utama:

1. Operator dapat menaikkan role dirinya menjadi supervisor.
2. Pendaftaran publik dapat membuat akun langsung sebagai supervisor.
3. Operator dapat menyisipkan handover berstatus `approved` tanpa approval.
4. Semua user yang login dapat membaca seluruh handover, termasuk data operasional dan catatan.
5. Audit trail handover tercatat ganda karena dua trigger audit aktif bersamaan.

Data saat ini relatif bersih: tidak ada orphan foreign key, jumlah `auth.users` sama dengan `profiles`, status handover konsisten dengan approval terakhir, dan seluruh `form_number` unik. Namun audit trail handover mengandung **50 baris duplikat dari 100 baris** (50%).

## 2. Matriks Temuan

| ID | Tingkat | Area | Ringkasan |
|---|---|---|---|
| K-01 | Kritis | RLS `profiles` | Operator dapat mengubah role sendiri menjadi supervisor |
| K-02 | Kritis | Auth trigger | Signup publik dapat menetapkan role supervisor dari user metadata |
| K-03 | Kritis | RLS `handovers` | Operator dapat insert handover berstatus `approved` |
| K-04 | Kritis | RLS `handovers` | Semua user login dapat membaca semua handover |
| K-05 | Kritis | RLS child tables | Handover `submitted` masih bisa ditambah activity/outstanding job |
| T-01 | Tinggi | RLS `approvals` | Semua user login dapat insert approval atas namanya sendiri |
| T-02 | Tinggi | Trigger audit | Dua trigger audit handover aktif, 50% baris audit duplikat |
| T-03 | Tinggi | RLS `approvals` | Semua user login dapat membaca semua approval |
| T-04 | Tinggi | RLS `profiles` | `profiles_insert` terbuka untuk semua role, termasuk `anon` |
| T-05 | Tinggi | Foreign key | `approvals.supervisor_id` mengarah ke `auth.users`, bukan `profiles` |
| T-06 | Tinggi | Alur aplikasi | Update status handover dan insert approval tidak atomik |
| T-07 | Tinggi | Privilege | `anon`/`authenticated` memiliki grant luas, termasuk `TRUNCATE` |
| T-08 | Tinggi | Trigger | `set_updated_at` pada `approvals` memanggil kolom yang tidak ada |
| T-09 | Tinggi | Constraint | `handovers.status` nullable dan timestamp tidak divalidasi DB |
| M-01 | Sedang | Data approval | Tidak ada idempotency; muncul approval berurutan dengan status sama |
| M-02 | Sedang | Alur edit/reopen | Metadata approval lama tidak dibersihkan saat reopen/edit |
| M-03 | Sedang | Function | `get_current_user_role()` SECURITY DEFINER dapat dipanggil `authenticated` |
| M-04 | Sedang | Performa | `handovers_select` mengevaluasi `auth.role()` per baris |
| M-05 | Sedang | View | `handover_sync` memberi grant tulis ke `anon` meski view tidak updatable |
| M-06 | Sedang | Foreign key | Hapus shift membuat `handovers.shift_id` menjadi null |
| M-07 | Rendah | Reporting | `approved_at` dipakai untuk rejected; `rejected_at` tidak dipakai |
| M-08 | Rendah | Validasi | Format `form_number` tidak divalidasi DB |
| M-09 | Rendah | Constraint | `profiles.role` nullable |
| M-10 | Rendah | Audit | Aksi audit tidak konsisten (`create` vs `INSERT`) |
| M-11 | Rendah | Auth | Proteksi password bocor (leaked password protection) nonaktif |
| M-12 | Rendah | JSONB | `operational_data` tidak memiliki validasi schema di DB |

## 3. Temuan Kritis

### K-01 — Operator dapat menaikkan role sendiri menjadi supervisor

**Bukti**

Policy `profiles_update`:

```sql
USING (
  id = (SELECT auth.uid())
  OR get_current_user_role() = 'supervisor'
)
```

Policy ini tidak memiliki `WITH CHECK`. Pada PostgreSQL, jika `WITH CHECK` tidak didefinisikan, ekspresi `USING` dipakai juga untuk memeriksa baris baru. Karena `id = auth.uid()` tetap benar setelah role diubah, operator dapat mengubah role dirinya sendiri.

**Dampak**

Operator dapat melakukan request berikut:

```http
PATCH /rest/v1/profiles?id=eq.<id-operator>
Content-Type: application/json

{ "role": "supervisor" }
```

Setelah berhasil, operator memperoleh seluruh akses supervisor: dashboard, settings, audit trail, approval, dan akses baca seluruh handover.

**Rekomendasi**

- Tambahkan trigger `BEFORE UPDATE` yang menolak perubahan `role` (dan `id`) kecuali pelaku adalah supervisor.
- Alternatif: cabut privilege update kolom `role`, lalu sediakan RPC khusus supervisor untuk mengubah role.
- Tambahkan `WITH CHECK` yang eksplisit; jangan mengandalkan fallback `USING`.

Contoh arah perbaikan:

```sql
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'ID profil tidak boleh diubah';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     AND public.get_current_user_role() <> 'supervisor' THEN
    RAISE EXCEPTION 'Hanya supervisor yang dapat mengubah role';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_profile_role_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_escalation();
```

### K-02 — Signup publik dapat langsung menjadi supervisor

**Bukti**

Function `handle_new_user()` mengambil role dari user metadata:

```sql
COALESCE(NEW.raw_user_meta_data->>'role', 'operator')
```

Konfigurasi Auth saat audit:

- `disable_signup = false`
- provider email aktif
- `mailer_autoconfirm = false` (perlu konfirmasi email)

`raw_user_meta_data` dapat diisi sendiri oleh pendaftar melalui `options.data` pada Supabase Auth. Dengan demikian, pendaftar dapat mengirim `role: "supervisor"` dan trigger akan membuat profil supervisor setelah email dikonfirmasi.

**Dampak**

Siapa pun yang dapat mengakses endpoint Auth publik berpotensi membuat akun supervisor tanpa persetujuan admin.

**Rekomendasi**

- Jangan pernah memakai `raw_user_meta_data` untuk otorisasi.
- Set role default `operator` pada trigger.
- Gunakan `raw_app_meta_data` hanya jika akun dibuat oleh admin/service role.
- Nonaktifkan signup publik jika aplikasi tidak membutuhkannya.
- Hapus `ON CONFLICT ... UPDATE role` agar role yang sudah ada tidak ditimpa metadata.
- Hapus `EXCEPTION WHEN OTHERS THEN RETURN NEW` agar kegagalan pembuatan profil tidak diam-diam menghasilkan user tanpa profil.

Contoh arah perbaikan:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'operator'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  RETURN NEW;
END;
$$;
```

### K-03 — Operator dapat insert handover berstatus `approved`

**Bukti**

Policy `handovers_insert`:

```sql
WITH CHECK (operator_id = (SELECT auth.uid()))
```

Tidak ada batasan status, `supervisor_id`, `approved_at`, `rejected_at`, atau `reopened_at`.

**Dampak**

Operator dapat membuat handover yang langsung berstatus `approved`, mengisi `supervisor_id` dengan profil supervisor mana pun, dan mengisi `approved_at` sendiri. Approval supervisor tidak pernah terjadi, tetapi data terlihat sah di laporan.

Operator juga dapat membuat handover `submitted`, `rejected`, atau `reopened` palsu yang memengaruhi submit gate dan tampilan supervisor.

**Rekomendasi**

- Batasi insert untuk status `draft` atau `submitted`.
- Paksa field approval (`supervisor_id`, `approved_at`, `rejected_at`, `reopened_at`) bernilai null saat insert.
- Tegakkan state machine di database, bukan hanya di UI.
- Jika supervisor perlu membuat handover, buat policy terpisah yang tetap mengikuti aturan status.

Contoh arah perbaikan:

```sql
DROP POLICY handovers_insert ON public.handovers;

CREATE POLICY handovers_insert
ON public.handovers
FOR INSERT
TO authenticated
WITH CHECK (
  operator_id = (SELECT auth.uid())
  AND status IN ('draft', 'submitted')
  AND supervisor_id IS NULL
  AND approved_at IS NULL
  AND rejected_at IS NULL
  AND reopened_at IS NULL
);
```

### K-04 — Semua user login dapat membaca semua handover

**Bukti**

Policy `handovers_select`:

```sql
USING (auth.role() = 'authenticated')
```

Aplikasi juga tidak memfilter operator pada halaman laporan:

- `src/app/(dashboard)/reports/page.tsx:50`
- `src/app/(dashboard)/reports/print/page.tsx:39`

Middleware mengizinkan operator membuka `/reports`.

**Dampak**

Operator dapat membaca dan mengekspor seluruh handover, termasuk data operasional, catatan, kendala, safety issue, dan riwayat shift. Ini bertentangan dengan klaim di `AGENTS.md` bahwa RLS membatasi operator ke handover miliknya.

**Rekomendasi**

```sql
DROP POLICY handovers_select ON public.handovers;

CREATE POLICY handovers_select
ON public.handovers
FOR SELECT
TO authenticated
USING (
  operator_id = (SELECT auth.uid())
  OR get_current_user_role() = 'supervisor'
);
```

Setelah policy diperbaiki, pastikan halaman laporan operator tetap berfungsi dengan data miliknya sendiri dan perbarui dokumentasi arsitektur.

### K-05 — Handover `submitted` masih bisa ditambah activity/outstanding job

**Bukti**

Policy `handover_activities_insert` dan `outstanding_jobs_insert` mengizinkan parent berstatus:

```sql
status = ANY (ARRAY['draft', 'submitted'])
```

**Dampak**

Operator dapat menambahkan activity atau outstanding job setelah handover disubmit, tanpa membuka kembali handover. Supervisor dapat melihat data yang berubah setelah review.

**Rekomendasi**

- Batasi insert ke parent status `draft` saja.
- Alur edit saat ini sudah mengubah `reopened` menjadi `draft` sebelum menulis child rows, sehingga pembatasan ini tidak memutus alur edit.
- Update/delete child rows sudah dibatasi ke `draft`; insert harus konsisten.

## 4. Temuan Tinggi

### T-01 — `approvals_insert` tidak memeriksa role supervisor

**Bukti**

```sql
WITH CHECK (supervisor_id = (SELECT auth.uid()))
```

**Dampak**

Semua user login, termasuk operator, dapat menyisipkan baris approval dengan `supervisor_id` miliknya sendiri untuk handover mana pun. Ini mencemari riwayat approval dan audit trail.

**Rekomendasi**

- Wajibkan `get_current_user_role() = 'supervisor'`.
- Wajibkan `supervisor_id = auth.uid()`.
- Pertimbangkan validasi status handover melalui RPC/trigger, bukan policy insert biasa, karena aplikasi saat ini mengubah status handover lebih dulu.

### T-02 — Dua trigger audit handover aktif bersamaan

**Bukti**

Trigger yang aktif pada `public.handovers`:

- `audit_handovers` → `audit_handovers_trigger()`
- `audit_handovers_trigger` → `audit_handovers()`

Keduanya `AFTER INSERT OR UPDATE OR DELETE`.

Hasil pengecekan:

- Total baris audit handover: **100**
- Perubahan unik: **50**
- Baris duplikat: **50**

**Dampak**

Audit trail tidak dapat dipercaya untuk menghitung jumlah perubahan atau merekonstruksi riwayat. Setiap perubahan handover tercatat dua kali, satu dengan `performed_by` dan satu tanpa `performed_by`.

**Rekomendasi**

- Pertahankan trigger yang mengisi `performed_by`.
- Hapus trigger dan function duplikat.
- Jangan hapus baris audit historis tanpa backup; jika perlu cleanup, lakukan setelah migrasi dan dengan persetujuan.

Contoh arah perbaikan:

```sql
DROP TRIGGER audit_handovers_trigger ON public.handovers;
DROP FUNCTION public.audit_handovers();
```

Setelah itu, hanya trigger `audit_handovers` yang memanggil `audit_handovers_trigger()` yang tersisa.

### T-03 — Semua user login dapat membaca semua approval

**Bukti**

Policy `approvals_select`:

```sql
USING (true)
```

untuk role `authenticated`.

**Dampak**

Operator dapat membaca seluruh keputusan approval, termasuk komentar penolakan, milik handover operator lain.

**Rekomendasi**

Batasi ke supervisor atau pemilik handover:

```sql
USING (
  get_current_user_role() = 'supervisor'
  OR EXISTS (
    SELECT 1
    FROM public.handovers h
    WHERE h.id = approvals.handover_id
      AND h.operator_id = (SELECT auth.uid())
  )
);
```

### T-04 — `profiles_insert` terbuka untuk semua role

**Bukti**

```sql
WITH CHECK (true)
```

Policy ini berlaku untuk role `public`, dan `anon` memiliki grant `INSERT` pada `profiles`.

**Dampak**

Secara teori, siapa pun dapat menyisipkan profil untuk `auth.users` yang sudah ada. Pada data saat ini semua auth user sudah memiliki profil, sehingga belum ada dampak langsung, tetapi policy ini tidak aman untuk user baru atau kondisi trigger gagal.

**Rekomendasi**

- Batasi insert ke supervisor, atau hapus policy dan andalkan trigger/service role.
- Cabut grant `INSERT` pada `profiles` dari `anon`.

### T-05 — Foreign key approval tidak konsisten

**Bukti**

```sql
approvals.supervisor_id REFERENCES auth.users(id)
```

Sedangkan `handovers.operator_id` dan `handovers.supervisor_id` mengarah ke `profiles(id)`.

**Dampak**

Approval dapat merujuk ke auth user yang tidak memiliki profil atau bukan supervisor. Validasi role tidak dapat dijamin oleh foreign key.

**Rekomendasi**

- Ubah FK `approvals.supervisor_id` ke `profiles(id)`.
- Pastikan tidak ada data orphan sebelum migrasi (saat audit: 0 orphan).
- Tetap wajibkan role supervisor melalui policy/RPC.

### T-06 — Update status handover dan insert approval tidak atomik

**Bukti**

`src/app/(dashboard)/approvals/page.tsx:93` mengubah status handover terlebih dahulu, lalu `src/app/(dashboard)/approvals/page.tsx:105` menyisipkan approval. Error pada insert approval tidak diperiksa.

**Dampak**

Jika insert approval gagal karena jaringan, RLS, atau constraint, handover sudah berubah menjadi `approved`/`rejected` tetapi tidak memiliki baris approval. Riwayat approval menjadi tidak lengkap.

**Rekomendasi**

- Buat function/RPC `approve_handover` dan `reject_handover` yang melakukan update status dan insert approval dalam satu transaksi.
- Minimal: periksa error insert, dan jika gagal, rollback status handover.
- Pertimbangkan insert approval lebih dulu, lalu update status, dengan kompensasi jika update gagal.

### T-07 — Grant terlalu luas untuk `anon` dan `authenticated`

**Bukti**

`anon` memiliki `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` pada seluruh tabel `public`. `authenticated` juga memiliki `TRUNCATE`.

**Dampak**

- `TRUNCATE` tidak dilindungi RLS. Meskipun PostgREST tidak mengekspos `TRUNCATE`, privilege ini tidak diperlukan dan berbahaya jika koneksi database disalahgunakan.
- Grant tulis pada `anon` memperbesar dampak jika ada policy yang salah.
- `profiles_insert` yang terbuka menjadi lebih berbahaya karena `anon` punya `INSERT`.

**Rekomendasi**

- `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;`
- Berikan grant minimal ke `authenticated` sesuai operasi yang benar-benar dipakai.
- Cabut `TRUNCATE`, `REFERENCES`, dan `TRIGGER` dari `authenticated` kecuali benar-benar diperlukan.
- Pastikan `service_role` tetap memiliki akses yang dibutuhkan untuk operasi admin.

### T-08 — Trigger `set_updated_at` pada `approvals` tidak valid

**Bukti**

Tabel `approvals` tidak memiliki kolom `updated_at`, tetapi memiliki trigger:

```sql
BEFORE UPDATE ON public.approvals
EXECUTE FUNCTION public.handle_updated_at()
```

Function tersebut menjalankan `NEW.updated_at = now();`.

**Dampak**

Setiap UPDATE pada `approvals` akan gagal dengan error kolom `updated_at` tidak ada. Saat ini belum ada policy UPDATE pada `approvals`, sehingga trigger belum terpicu dari aplikasi, tetapi akan menjadi bug jika fitur edit approval ditambahkan.

**Rekomendasi**

- Jika approval bersifat immutable, drop trigger `set_updated_at` pada `approvals`.
- Jika approval perlu diedit, tambahkan kolom `updated_at` dan policy UPDATE yang sesuai.

### T-09 — Constraint handover terlalu lemah

**Bukti**

- `handovers.status` nullable dan CHECK mengizinkan `NULL`.
- Tidak ada CHECK yang mengaitkan `status` dengan `submitted_at`, `approved_at`, `rejected_at`, atau `reopened_at`.
- `status` masih menyertakan nilai legacy `acknowledged`.

**Dampak**

Direct insert/update dapat menghasilkan handover dengan status null atau status `approved` tanpa timestamp/supervisor. Kombinasi dengan K-03 membuat bypass approval lebih mudah.

**Rekomendasi**

- `status NOT NULL DEFAULT 'draft'`.
- Tambahkan trigger state machine yang memvalidasi transisi status dan field wajib.
- Hapus `acknowledged` dari CHECK jika benar-benar tidak dipakai.
- Tambahkan constraint bahwa `approved_at`/`supervisor_id` terisi untuk `approved`/`rejected`.

## 5. Temuan Sedang dan Rendah

### M-01 — Tidak ada idempotency pada approval

Riwayat approval menunjukkan beberapa keputusan berurutan dengan status sama, misalnya dua `rejected` dalam 13 detik dan dua `approved` berurutan. Sebagian bisa berasal dari siklus reopen, tetapi pola ini juga konsisten dengan double-click atau submit ganda.

Rekomendasi:

- Nonaktifkan tombol saat request berjalan.
- Tambahkan guard di RPC/trigger agar approval hanya dapat dibuat saat handover berstatus `submitted` atau `reopened`.
- Jangan menambahkan unique index sederhana karena reopen dapat menghasilkan approval sah lebih dari satu.

### M-02 — Metadata approval lama tidak dibersihkan saat reopen/edit

`src/app/(dashboard)/handover/[id]/edit/page.tsx:270` mengubah status menjadi `draft` dan mengosongkan `submitted_at`, tetapi tidak mengosongkan `supervisor_id`, `approved_at`, atau `rejected_at`. Akibatnya, handover yang sedang draft/submitted dapat membawa metadata approval dari siklus sebelumnya.

Rekomendasi:

- Kosongkan field approval saat reopen atau saat submit ulang.
- Simpan riwayat approval hanya di tabel `approvals`, bukan di kolom ringkasan handover.

### M-03 — `get_current_user_role()` SECURITY DEFINER dapat dipanggil `authenticated`

Function ini diperlukan oleh RLS dan mengembalikan role milik pemanggil. Dampak langsungnya rendah, tetapi Supabase advisor menandainya.

Rekomendasi:

- Gunakan `SET search_path = ''` dan qualified name.
- Jangan mencabut EXECUTE dari `authenticated` tanpa menguji policy, karena policy RLS memanggil function ini.
- Jika ingin menghilangkan RPC publik, gunakan function internal dengan schema khusus dan grant terbatas.

### M-04 — Performa policy `handovers_select`

`auth.role()` dievaluasi per baris. Gunakan `(SELECT auth.role())` atau function role yang sudah di-cache.

Catatan performa lain:

- Ada beberapa index yang belum terpakai menurut advisor.
- Index tersebut tidak mendesak untuk dihapus sebelum pola query stabil.

### M-05 — Grant tulis pada view `handover_sync`

View memiliki `security_invoker = true` dan tidak updatable, tetapi `anon` masih memiliki grant `INSERT/UPDATE/DELETE/TRUNCATE`. Grant tersebut tidak efektif karena view tidak updatable, tetapi tetap sebaiknya dicabut.

Rekomendasi:

- Cabut semua grant dari `anon`.
- Berikan hanya `SELECT` ke `authenticated`.
- Pastikan `security_invoker = true` dipertahankan.

### M-06 — Hapus shift membuat referensi handover menjadi null

FK `handovers.shift_id` menggunakan `ON DELETE SET NULL`. Handover historis kehilangan informasi shift jika shift dihapus.

Rekomendasi:

- Gunakan `ON DELETE RESTRICT` jika shift yang sudah dipakai tidak boleh dihapus.
- Atau simpan snapshot nama shift di handover.

### M-07 — Semantik `approved_at` dan `rejected_at`

`approved_at` diisi juga saat handover ditolak, sedangkan `rejected_at` tidak dipakai. Ini membingungkan untuk reporting.

Rekomendasi:

- Gunakan `approved_at` hanya untuk approved dan `rejected_at` untuk rejected.
- Atau ganti dengan satu kolom `decided_at` dan `decision`.

### M-08 — Format `form_number` tidak divalidasi

Database hanya memiliki unique constraint. Format `SH-YYYYMMDD-NNN` hanya dijaga oleh aplikasi.

Rekomendasi:

- Tambahkan CHECK regex, misalnya `form_number ~ '^SH-[0-9]{8}-[0-9]{3}$'`.

### M-09 — `profiles.role` nullable

Role dapat bernilai null karena kolom nullable dan CHECK mengizinkan null.

Rekomendasi:

- `role NOT NULL DEFAULT 'operator'`.

### M-10 — Aksi audit tidak konsisten

`audit_trigger_function` menulis `create/update/delete`, sedangkan `audit_handovers_trigger` menulis `INSERT/UPDATE/DELETE`.

Rekomendasi:

- Standarkan nilai aksi, misalnya selalu `INSERT/UPDATE/DELETE`.
- Sesuaikan query laporan audit.

### M-11 — Proteksi password bocor nonaktif

Supabase Auth saat audit menunjukkan leaked password protection nonaktif.

Rekomendasi:

- Aktifkan leaked password protection di pengaturan Auth.

### M-12 — `operational_data` tidak divalidasi di database

Tipe dan struktur `operational_data` hanya dijaga oleh TypeScript di aplikasi. Direct API dapat menyimpan JSON dengan bentuk yang tidak sesuai.

Rekomendasi:

- Tambahkan validasi JSONB di trigger atau constraint untuk field wajib.
- Minimal validasi bahwa `operational_data` adalah object dan array utama bertipe array.
- Catatan: `teams` adalah object, bukan array, dan itu sesuai desain saat ini.

## 6. Integritas Data Saat Ini

| Pemeriksaan | Hasil |
|---|---|
| Jumlah `auth.users` vs `profiles` | Lulus: 2 = 2 |
| Auth user tanpa profil | Lulus: 0 |
| Profil tanpa auth user | Lulus: 0 |
| Orphan `handovers.operator_id` | Lulus: 0 |
| Orphan `handovers.supervisor_id` | Lulus: 0 |
| Orphan `handovers.shift_id` | Lulus: 0 |
| Orphan `handover_activities` | Lulus: 0 |
| Orphan `approvals` | Lulus: 0 |
| Orphan `outstanding_jobs` | Lulus: 0 |
| Approval terakhir vs status handover | Lulus: 0 mismatch |
| Konsistensi status/timestamp handover | Lulus: 0 anomali |
| `form_number` unik | Lulus |
| Struktur array `operational_data` | Lulus |
| Duplikasi audit handover | Gagal: 50 dari 100 baris duplikat |
| Approval berurutan dengan status sama | Perlu perhatian |

Observasi data:

- Seluruh 11 handover saat ini berstatus `approved`.
- Beberapa handover memiliki `reopened_at` yang tetap terisi setelah approved. Ini dapat dimaknai sebagai “pernah dibuka kembali”, bukan status saat ini.
- Riwayat approval memiliki beberapa siklus rejected/approved yang konsisten dengan reopen, tetapi ada juga keputusan berulang dalam hitungan detik yang perlu ditinjau.

## 7. Rencana Remediasi yang Disarankan

### Fase 1 — Perbaikan kritis dan tinggi di database

Buat migration baru, misalnya `supabase/migrations/14_security_hardening.sql`, yang mencakup:

1. Trigger pencegahan eskalasi role pada `profiles`.
2. Penulisan ulang `handle_new_user()` agar tidak memakai role dari user metadata.
3. Penonaktifan signup publik jika tidak diperlukan.
4. Perbaikan policy:
   - `handovers_select`
   - `handovers_insert`
   - `handover_activities_insert`
   - `outstanding_jobs_insert`
   - `approvals_insert`
   - `approvals_select`
   - `profiles_insert`
5. Deduplikasi trigger audit handover.
6. Perbaikan FK `approvals.supervisor_id`.
7. Perbaikan trigger `set_updated_at` pada `approvals`.
8. Constraint `NOT NULL` dan state machine handover.
9. Pencabutan grant berlebihan dari `anon` dan `authenticated`.

Catatan migrasi:

- Jangan mengulang migration `01`–`09` setelah `10` karena migration awal membuat RLS permisif.
- Terapkan migration baru setelah seluruh migration yang sudah ada.
- Backup database sebelum migrasi.
- Uji policy sebagai operator dan supervisor setelah migrasi.

### Fase 2 — Perbaikan alur aplikasi

1. Jadikan approve/reject atomik melalui RPC atau transaksi.
2. Periksa error insert approval dan rollback status jika gagal.
3. Kosongkan metadata approval lama saat reopen/edit.
4. Cegah double submit pada tombol approve/reject.
5. Perbarui `AGENTS.md` dan `docs/arsitektur-dan-alur-sistem.md` agar sesuai dengan RLS yang sebenarnya.

### Fase 3 — Perbaikan sedang/rendah

1. Optimasi policy `handovers_select`.
2. Rapikan grant pada `handover_sync`.
3. Tinjau `ON DELETE SET NULL` pada `handovers.shift_id`.
4. Standarkan semantik timestamp approval.
5. Tambahkan validasi `form_number`.
6. Jadikan `profiles.role` NOT NULL.
7. Standarkan aksi audit.
8. Aktifkan leaked password protection.
9. Tambahkan validasi `operational_data` bila diperlukan.

## 8. Rencana Pengujian Setelah Perbaikan

Uji sebagai operator:

- Tidak dapat membaca handover milik operator lain.
- Tidak dapat mengubah role sendiri.
- Tidak dapat insert handover `approved`/`rejected`/`reopened`.
- Tidak dapat insert activity/outstanding job pada handover `submitted`.
- Tidak dapat insert approval.
- Tetap dapat membuat draft, submit handover sendiri, dan mengedit handover `reopened` miliknya.

Uji sebagai supervisor:

- Dapat membaca semua handover.
- Dapat approve/reject/reopen.
- Dapat mengubah role pengguna lain.
- Dapat mengelola shift dan tank product.

Uji sistem:

- Signup baru menghasilkan profil `operator`.
- Setiap perubahan handover menghasilkan tepat satu baris audit.
- Approve/reject menghasilkan status handover dan baris approval yang konsisten.
- Tidak ada error saat update `approvals` (atau trigger sudah dihapus).
- `anon` tidak dapat membaca/menulis tabel `public`.

## 9. Catatan

- Audit ini tidak mengubah database.
- Temuan bersifat snapshot per 30 Oktober 2026; policy, data, dan konfigurasi dapat berubah setelah dokumen ini ditulis.
- Contoh SQL di dokumen ini adalah arah perbaikan, bukan migration yang sudah diterapkan.
- Sebelum menerapkan perubahan, backup database dan tinjau dampaknya terhadap halaman laporan, approval, dan dokumen cetak.
