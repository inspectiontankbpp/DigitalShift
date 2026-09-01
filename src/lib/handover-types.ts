export interface TankLevel {
  id?: string
  jam: string
  produk: string
  noTanki: string
  level: string
  water: string
  keterangan: string
}

export interface QCCheck {
  id?: string
  noSarfas: string
  visual: string
  density: string
  temperatur: string
  keterangan: string
}

export interface CriticalEquipment {
  id?: string
  kategori: "Penerimaan" | "Penimbunan" | "Penyaluran"
  namaPeralatan: string
  status: string
  kondisi: string
  keterangan: string
}

export interface SafetyTool {
  id?: string
  nama: string
  status: string
  kondisi: string
  keterangan: string
}

export interface TransferRequest {
  id?: string
  noTangki: string
  namaProduk: string
  estJumlahKL: string
  estimasiJam: string
  keterangan: string
}

export interface HandoverTeams {
  yangMenyerahkan: {
    danru: string
    anggota1: string
    anggota2: string
    anggota3: string
  }
  yangMenerima: {
    danru: string
    anggota1: string
    anggota2: string
    anggota3: string
  }
  mengetahui: {
    spv: string
  }
}

export interface OperationalData {
  reguShift?: string
  jamShift?: string
  tankLevels?: TankLevel[]
  qcChecks?: QCCheck[]
  criticalEquipment?: CriticalEquipment[]
  safetyTools?: SafetyTool[]
  transferRequests?: TransferRequest[]
  teams?: HandoverTeams
}

export const DEFAULT_SAFETY_TOOLS: SafetyTool[] = [
  { nama: "HT 1 (C. Room)", status: "ADA", kondisi: "Berfungsi", keterangan: "" },
  { nama: "HT 2 (Rmh. Pompa)", status: "ADA", kondisi: "Berfungsi", keterangan: "" },
  { nama: "Gas Detektor 1", status: "ADA", kondisi: "Berfungsi", keterangan: "" },
  { nama: "Gas Detektor 2", status: "ADA", kondisi: "Berfungsi", keterangan: "" },
  { nama: "Senter 1", status: "ADA", kondisi: "Berfungsi", keterangan: "" },
  { nama: "Senter 2", status: "ADA", kondisi: "Berfungsi", keterangan: "" },
  { nama: "Tablet Isafe Mobile", status: "ADA", kondisi: "Berfungsi", keterangan: "" },
  { nama: "Body Harness", status: "ADA", kondisi: "Berfungsi", keterangan: "" },
]

export const DEFAULT_CRITICAL_EQUIPMENT: CriticalEquipment[] = [
  { kategori: "Penerimaan", namaPeralatan: "MOV", status: "OK", kondisi: "Berfungsi", keterangan: "" },
  { kategori: "Penerimaan", namaPeralatan: "Valve In Tangki", status: "OK", kondisi: "Berfungsi", keterangan: "" },
  { kategori: "Penerimaan", namaPeralatan: "Valve Out Tangki", status: "OK", kondisi: "Berfungsi", keterangan: "" },
  { kategori: "Penerimaan", namaPeralatan: "ATG", status: "OK", kondisi: "Berfungsi", keterangan: "" },
  { kategori: "Penerimaan", namaPeralatan: "Valve Manual", status: "OK", kondisi: "Berfungsi", keterangan: "" },
  { kategori: "Penimbunan", namaPeralatan: "MOV", status: "OK", kondisi: "Berfungsi", keterangan: "" },
  { kategori: "Penimbunan", namaPeralatan: "Valve In Tangki", status: "OK", kondisi: "Berfungsi", keterangan: "" },
  { kategori: "Penimbunan", namaPeralatan: "Valve Out Tangki", status: "OK", kondisi: "Berfungsi", keterangan: "" },
  { kategori: "Penimbunan", namaPeralatan: "ATG", status: "OK", kondisi: "Berfungsi", keterangan: "" },
  { kategori: "Penimbunan", namaPeralatan: "Valve Manual", status: "OK", kondisi: "Berfungsi", keterangan: "" },
  { kategori: "Penyaluran", namaPeralatan: "MOV Out Tanki", status: "OK", kondisi: "Berfungsi", keterangan: "" },
  { kategori: "Penyaluran", namaPeralatan: "ATG", status: "OK", kondisi: "Berfungsi", keterangan: "" },
  { kategori: "Penyaluran", namaPeralatan: "Valve Manual", status: "OK", kondisi: "Berfungsi", keterangan: "" },
]
