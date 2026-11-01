"use client"

import React from "react"
import { OperationalData } from "@/lib/handover-types"

function formatTimeDisplay(value: unknown): string {
  const text = String(value ?? "").trim()
  if (!text) return "-"
  const match = text.match(/^(\d{1,2})[:.](\d{2})/)
  if (!match) return text
  return `${match[1].padStart(2, "0")}:${match[2]}`
}

interface ShiftHandoverDocumentProps {
  handover: {
    form_number?: string
    tanggal?: string
    status?: string
    shifts?: { name?: string; start_time?: string; end_time?: string }
    profiles?: { full_name?: string }
    catatan?: string
    kondisi_operasional?: string
    operational_data?: OperationalData
  }
  activities?: Array<{
    waktu?: string
    aktivitas?: string
    deskripsi?: string
    status?: string
  }>
}

export function ShiftHandoverDocument({ handover, activities = [] }: ShiftHandoverDocumentProps) {
  const opData: OperationalData = handover.operational_data || {}

  const dateObj = handover.tanggal ? new Date(handover.tanggal) : new Date()
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ]
  const formattedDayDate = `${days[dateObj.getDay()]} / ${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`

  const shiftName = opData.reguShift || handover.shifts?.name || "Regu 2 / Sore"
  const jamShift = opData.jamShift || (handover.shifts ? `${handover.shifts.start_time || ''} s/d ${handover.shifts.end_time || ''}` : "16:00 s/d 24:00")

  const tankLevels = opData.tankLevels || []
  const qcChecks = opData.qcChecks || []
  const criticalEq = opData.criticalEquipment || []
  const safetyTools = opData.safetyTools || []
  const transferRequests = opData.transferRequests || []
  const teams = opData.teams || {
    yangMenyerahkan: { danru: handover.profiles?.full_name || "", anggota1: "", anggota2: "", anggota3: "" },
    yangMenerima: { danru: "", anggota1: "", anggota2: "", anggota3: "" },
    mengetahui: { spv: "" }
  }

  const criticalPenerimaan = criticalEq.filter(item => item.kategori === "Penerimaan")
  const criticalPenimbunan = criticalEq.filter(item => item.kategori === "Penimbunan")
  const criticalPenyaluran = criticalEq.filter(item => item.kategori === "Penyaluran")

  return (
    <div className="w-full max-w-4xl mx-auto bg-white text-black font-sans p-6 border shadow-sm print:shadow-none print:p-0 print:border-none print:max-w-none print:mx-0 text-xs sm:text-sm">
      {/* Header with Logos */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-2">
        <div className="w-24 sm:w-28 shrink-0 flex justify-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pertamina.png" alt="Pertamina" className="max-h-14 sm:max-h-16 object-contain" />
        </div>
        <div className="flex-1 text-center font-bold text-base sm:text-lg uppercase tracking-wide m-0">
          Formulir Serah Terima Shift
        </div>
        <div className="w-24 sm:w-28 shrink-0 flex justify-end">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/danantara.png" alt="Danantara" className="max-h-14 sm:max-h-16 object-contain" />
        </div>
      </div>

      {/* Meta Table */}
      <table className="w-full border-collapse border border-black mb-4">
        <tbody>
          <tr>
            <td className="border border-black p-2 font-bold bg-gray-100 w-1/4">Hari / tanggal</td>
            <td className="border border-black p-2">{formattedDayDate}</td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-bold bg-gray-100">Regu Shift</td>
            <td className="border border-black p-2">{shiftName}</td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-bold bg-gray-100">Jam Shift</td>
            <td className="border border-black p-2">{jamShift}</td>
          </tr>
        </tbody>
      </table>

      {/* Detail Kegiatan / Aktifitas */}
      <div className="mb-4">
        <div className="font-bold text-sm bg-gray-200 border border-black p-1.5 border-b-0">
          Detail Kegiatan / Aktifitas
        </div>
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100 text-center font-bold">
              <th className="border border-black p-2 w-20">Pukul</th>
              <th className="border border-black p-2 text-left">Detail Kegiatan / Aktifitas</th>
            </tr>
          </thead>
          <tbody>
            {activities.length > 0 ? (
              activities.map((act, idx) => {
                const subs = act.deskripsi
                  ? act.deskripsi.split(". ").filter(s => s.trim() && s.trim() !== act.aktivitas)
                  : []
                return (
                  <tr key={idx}>
                    <td className="border border-black p-2 text-center font-semibold align-top">{formatTimeDisplay(act.waktu)}</td>
                    <td className="border border-black p-2">
                      <div className="font-bold">{act.aktivitas}</div>
                      {subs.length > 0 && (
                        <ul className="list-disc list-inside mt-1">
                          {subs.map((sub, si) => (
                            <li key={si} className="text-xs">{sub}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={2} className="border border-black p-4 text-center text-gray-500 italic">
                  Tidak ada catatan kegiatan shift
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pengukuran Manual Level dan Water Tangki Timbun */}
      <div className="mb-4 page-break-inside-avoid">
        <div className="font-bold text-xs bg-gray-200 border border-black p-1.5 border-b-0">
          Pengukuran Manual Level dan Water Tangki Timbun
        </div>
        <table className="w-full border-collapse border border-black text-xs text-center">
          <thead>
            <tr className="bg-gray-100 font-bold">
              <th className="border border-black p-1.5 w-16">JAM</th>
              <th className="border border-black p-1.5">PRODUK</th>
              <th className="border border-black p-1.5">No.Tanki</th>
              <th className="border border-black p-1.5">LEVEL</th>
              <th className="border border-black p-1.5">WATER</th>
              <th className="border border-black p-1.5 text-left">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {tankLevels.length > 0 ? (
              tankLevels.map((row, idx) => (
                <tr key={idx}>
                  <td className="border border-black p-1.5">{formatTimeDisplay(row.jam)}</td>
                  <td className="border border-black p-1.5 font-medium">{row.produk || "-"}</td>
                  <td className="border border-black p-1.5">{row.noTanki || "-"}</td>
                  <td className="border border-black p-1.5">{row.level || "-"}</td>
                  <td className="border border-black p-1.5">{row.water || "-"}</td>
                  <td className="border border-black p-1.5 text-left">{row.keterangan || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="border border-black p-2 text-center text-gray-400 italic">
                  Belum ada data pengukuran manual tangki
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pemeriksaan Quality Control */}
      <div className="mb-4 page-break-inside-avoid">
        <div className="font-bold text-xs bg-gray-200 border border-black p-1.5 border-b-0">
          Pemeriksaan Quality Control
        </div>
        <table className="w-full border-collapse border border-black text-xs text-center">
          <thead>
            <tr className="bg-gray-100 font-bold">
              <th className="border border-black p-1.5 w-24">No. Sarfas</th>
              <th className="border border-black p-1.5">Visual</th>
              <th className="border border-black p-1.5">Density</th>
              <th className="border border-black p-1.5">Temperatur</th>
              <th className="border border-black p-1.5 text-left">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {qcChecks.length > 0 ? (
              qcChecks.map((row, idx) => (
                <tr key={idx}>
                  <td className="border border-black p-1.5 font-medium">{row.noSarfas || "-"}</td>
                  <td className="border border-black p-1.5">{row.visual || "-"}</td>
                  <td className="border border-black p-1.5">{row.density || "-"}</td>
                  <td className="border border-black p-1.5">{row.temperatur || "-"}</td>
                  <td className="border border-black p-1.5 text-left">{row.keterangan || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="border border-black p-2 text-center text-gray-400 italic">
                  Belum ada data QC
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pemeriksaan Peralatan Operasi Kritikal */}
      <div className="mb-4 page-break-inside-avoid">
        <div className="font-bold text-xs bg-gray-200 border border-black p-1.5 border-b-0">
          Pemeriksaan Peralatan Operasi Kritikal
        </div>
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100 font-bold text-center">
              <th className="border border-black p-1.5 w-28 text-left">Kategori</th>
              <th className="border border-black p-1.5 text-left">Nama Peralatan</th>
              <th className="border border-black p-1.5 w-16">Status</th>
              <th className="border border-black p-1.5 w-24">Kondisi</th>
              <th className="border border-black p-1.5 text-left">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {/* Penerimaan */}
            {criticalPenerimaan.map((item, idx) => (
              <tr key={`pen-${idx}`}>
                {idx === 0 && (
                  <td rowSpan={criticalPenerimaan.length} className="border border-black p-1.5 font-bold align-top bg-gray-50">
                    Penerimaan
                  </td>
                )}
                <td className="border border-black p-1.5">{item.namaPeralatan}</td>
                <td className="border border-black p-1.5 text-center font-semibold">{item.status}</td>
                <td className="border border-black p-1.5 text-center">{item.kondisi}</td>
                <td className="border border-black p-1.5">{item.keterangan || "-"}</td>
              </tr>
            ))}

            {/* Penimbunan */}
            {criticalPenimbunan.map((item, idx) => (
              <tr key={`timb-${idx}`}>
                {idx === 0 && (
                  <td rowSpan={criticalPenimbunan.length} className="border border-black p-1.5 font-bold align-top bg-gray-50">
                    Penimbunan
                  </td>
                )}
                <td className="border border-black p-1.5">{item.namaPeralatan}</td>
                <td className="border border-black p-1.5 text-center font-semibold">{item.status}</td>
                <td className="border border-black p-1.5 text-center">{item.kondisi}</td>
                <td className="border border-black p-1.5">{item.keterangan || "-"}</td>
              </tr>
            ))}

            {/* Penyaluran */}
            {criticalPenyaluran.map((item, idx) => (
              <tr key={`sal-${idx}`}>
                {idx === 0 && (
                  <td rowSpan={criticalPenyaluran.length} className="border border-black p-1.5 font-bold align-top bg-gray-50">
                    Penyaluran
                  </td>
                )}
                <td className="border border-black p-1.5">{item.namaPeralatan}</td>
                <td className="border border-black p-1.5 text-center font-semibold">{item.status}</td>
                <td className="border border-black p-1.5 text-center">{item.kondisi}</td>
                <td className="border border-black p-1.5">{item.keterangan || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Grid 2 Kolom: Checklist Safety Tools & Permintaan Transfer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 page-break-inside-avoid">
          {/* Safety & Work Tools */}
          <div>
            <div className="font-bold text-xs bg-gray-200 border border-black p-1.5 border-b-0">
              Pemeriksaan Perlengkapan Safety
            </div>
            <table className="w-full border-collapse border border-black text-xs">
              <thead>
                <tr className="bg-gray-100 font-bold text-center">
                  <th className="border border-black p-1.5 text-left">Nama</th>
                  <th className="border border-black p-1.5 w-16">Status</th>
                  <th className="border border-black p-1.5 w-16">Kondisi</th>
                  <th className="border border-black p-1.5 text-left">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {safetyTools.map((tool, idx) => (
                  <tr key={idx}>
                    <td className="border border-black p-1.5">{tool.nama}</td>
                    <td className="border border-black p-1.5 text-center font-semibold">{tool.status}</td>
                    <td className="border border-black p-1.5 text-center">{tool.kondisi}</td>
                    <td className="border border-black p-1.5">{tool.keterangan || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        {/* Permintaan Transfer Tangki */}
        <div>
          <div className="font-bold text-xs bg-gray-200 border border-black p-1.5 border-b-0">
            Permintaan Transfer Tangki
          </div>
          <table className="w-full border-collapse border border-black text-xs">
            <thead>
              <tr className="bg-gray-100 font-bold text-center">
                <th className="border border-black p-1.5 w-12">No</th>
                <th className="border border-black p-1.5 text-left">Produk</th>
                <th className="border border-black p-1.5 w-16">Jumlah</th>
                <th className="border border-black p-1.5 text-left">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {transferRequests.length > 0 ? (
                transferRequests.map((req, idx) => (
                  <tr key={idx}>
                    <td className="border border-black p-1.5 text-center">{req.noTangki}</td>
                    <td className="border border-black p-1.5 font-medium">{req.namaProduk}</td>
                    <td className="border border-black p-1.5 text-center">{req.estJumlahKL} KL</td>
                    <td className="border border-black p-1.5">{req.keterangan}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="border border-black p-4 text-center text-gray-400 italic">
                    Tidak ada permintaan transfer
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signatures & Handover Acknowledgement Section */}
      <div className="border border-black p-3 mt-4 page-break-inside-avoid">
        <div className="grid grid-cols-2 gap-4 border-b border-black pb-4 text-xs">
          {/* Yang Menyerahkan */}
          <div>
            <div className="font-bold border-b border-black pb-1 mb-2 text-center bg-gray-100">
              Yang Menyerahkan (Shift / Jam: {shiftName})
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="font-bold">Pws / Danru Shift:</span>
                <span>{teams.yangMenyerahkan?.danru || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Anggota 1:</span>
                <span>{teams.yangMenyerahkan?.anggota1 || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Anggota 2:</span>
                <span>{teams.yangMenyerahkan?.anggota2 || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Anggota 3:</span>
                <span>{teams.yangMenyerahkan?.anggota3 || "-"}</span>
              </div>
            </div>
          </div>

          {/* Yang Menerima */}
          <div>
            <div className="font-bold border-b border-black pb-1 mb-2 text-center bg-gray-100">
              Yang Menerima (Shift / Jam)
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="font-bold">Pws / Danru Shift:</span>
                <span>{teams.yangMenerima?.danru || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Anggota 1:</span>
                <span>{teams.yangMenerima?.anggota1 || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Anggota 2:</span>
                <span>{teams.yangMenerima?.anggota2 || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Anggota 3:</span>
                <span>{teams.yangMenerima?.anggota3 || "-"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mengetahui */}
        <div className="pt-3 text-xs">
          <div className="font-bold border-b border-black pb-1 mb-2 text-center bg-gray-100">Mengetahui</div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="font-medium border-b border-black pb-1 mb-2">Danru</div>
              <div className="h-12"></div>
              <p className="font-bold">{teams.yangMenyerahkan?.danru || "-"}</p>
            </div>
            <div>
              <div className="font-medium border-b border-black pb-1 mb-2">Sr. Spv II Fuel & LPG RSD</div>
              <div className="h-12"></div>
              <p className="font-bold">{teams.mengetahui?.spv || ""}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 text-[10px] text-gray-500 italic text-center print:block">
        * Catatan: dapat disertakan lampiran formulir-formulir atau dokumen catatan lain yang terkait.
      </div>
    </div>
  )
}
