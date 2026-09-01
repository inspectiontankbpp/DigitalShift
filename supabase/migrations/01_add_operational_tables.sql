-- SQL Migration: Add Operational Tables & Operational Data JSONB Column
-- Run this in your Supabase SQL Editor if needed.

-- Add operational_data column to handovers table if it doesn't exist
ALTER TABLE handovers ADD COLUMN IF NOT EXISTS operational_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE handovers ADD COLUMN IF NOT EXISTS regu_shift TEXT;
ALTER TABLE handovers ADD COLUMN IF NOT EXISTS jam_shift TEXT;

-- 1. Pengukuran Manual Level dan Water Tangki Timbun
CREATE TABLE IF NOT EXISTS handover_tank_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handover_id UUID REFERENCES handovers(id) ON DELETE CASCADE,
    jam TEXT,
    produk TEXT,
    no_tanki TEXT,
    level TEXT,
    water TEXT,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Pemeriksaan Quality Control
CREATE TABLE IF NOT EXISTS handover_qc_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handover_id UUID REFERENCES handovers(id) ON DELETE CASCADE,
    no_sarfas TEXT,
    visual TEXT,
    density TEXT,
    temperatur TEXT,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Pemeriksaan Peralatan Operasi Kritikal
CREATE TABLE IF NOT EXISTS handover_critical_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handover_id UUID REFERENCES handovers(id) ON DELETE CASCADE,
    kategori TEXT CHECK (kategori IN ('Penerimaan', 'Penimbunan', 'Penyaluran')),
    nama_peralatan TEXT,
    status TEXT DEFAULT 'OK',
    kondisi TEXT DEFAULT 'Berfungsi',
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Checklist Peralatan Operasional & Safety
CREATE TABLE IF NOT EXISTS handover_safety_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handover_id UUID REFERENCES handovers(id) ON DELETE CASCADE,
    nama TEXT,
    status TEXT DEFAULT 'ADA',
    keterangan TEXT DEFAULT 'Berfungsi',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Permintaan Transfer Tangki
CREATE TABLE IF NOT EXISTS handover_transfer_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handover_id UUID REFERENCES handovers(id) ON DELETE CASCADE,
    no_tangki TEXT,
    nama_produk TEXT,
    est_jumlah_kl TEXT,
    estimasi_jam TEXT,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables (if needed)
ALTER TABLE handover_tank_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_qc_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_critical_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_safety_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_transfer_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and insert
CREATE POLICY "Allow authenticated read handover_tank_levels" ON handover_tank_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert handover_tank_levels" ON handover_tank_levels FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated read handover_qc_checks" ON handover_qc_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert handover_qc_checks" ON handover_qc_checks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated read handover_critical_equipment" ON handover_critical_equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert handover_critical_equipment" ON handover_critical_equipment FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated read handover_safety_tools" ON handover_safety_tools FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert handover_safety_tools" ON handover_safety_tools FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated read handover_transfer_requests" ON handover_transfer_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert handover_transfer_requests" ON handover_transfer_requests FOR INSERT TO authenticated WITH CHECK (true);
