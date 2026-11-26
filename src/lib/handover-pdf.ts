import { jsPDF } from "jspdf"
import type { OperationalData } from "@/lib/handover-types"
import { parseDateValue } from "@/lib/format"

interface PdfHandover {
  form_number?: string
  tanggal?: string
  status?: string
  shifts?: { name?: string } | null
  profiles?: { full_name?: string } | null
  catatan?: string | null
  operational_data?: OperationalData | null
}

interface PdfActivity {
  waktu?: string
  aktivitas?: string
  deskripsi?: string
  status?: string
}

type Align = "left" | "center" | "right"

interface Column {
  header: string
  width: number
  align?: Align
}

interface CellLine {
  text: string
  bold?: boolean
}

type Cell = string | CellLine[]

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 10
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const PAD_X = 1.8
const PAD_Y = 1.8
const LINE_HEIGHT = 3.4
const BODY_SIZE = 7.5
const TITLE_BAND = 6
const HEADER_FILL: [number, number, number] = [243, 244, 246]
const SECTION_FILL: [number, number, number] = [229, 231, 235]
const GROUP_FILL: [number, number, number] = [249, 250, 251]
const EMPTY_GRAY: [number, number, number] = [156, 163, 175]

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

function formatTime(value?: string) {
  const text = String(value ?? "").trim()
  if (!text) return "-"
  const match = text.match(/^(\d{1,2})[:.](\d{2})/)
  if (!match) return text
  return `${match[1].padStart(2, "0")}:${match[2]}`
}

function longDate(value?: string) {
  const date = parseDateValue(value)
  if (!date) return "-"
  return `${DAYS[date.getDay()]} / ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

function normalizeShiftName(raw: string) {
  if (/pagi|regu\s*1|regu1/i.test(raw)) return "Pagi"
  if (/malam|regu\s*3|regu3/i.test(raw)) return "Malam"
  if (/sore|siang|regu\s*2|regu2/i.test(raw)) return "Sore"
  return raw
}

export interface LogoAsset {
  data: string
  width: number
  height: number
}

const logoCache = new Map<string, Promise<LogoAsset | null>>()

async function loadLogo(url: string): Promise<LogoAsset | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    const image = new Image()
    image.src = data
    await image.decode()
    return { data, width: image.naturalWidth, height: image.naturalHeight }
  } catch {
    return null
  }
}

export function getLogoAsset(url: string): Promise<LogoAsset | null> {
  const cached = logoCache.get(url)
  if (cached) return cached
  const promise = loadLogo(url)
  logoCache.set(url, promise)
  return promise
}

export async function renderHandoverPdf(
  doc: jsPDF,
  handover: PdfHandover,
  activities: PdfActivity[] = []
): Promise<void> {
  const op: OperationalData = handover.operational_data || {}
  const pageBottom = PAGE_HEIGHT - MARGIN
  let y = MARGIN

  const rawShift = op.reguShift || handover.shifts?.name || "Sore"
  const shiftName = normalizeShiftName(rawShift)
  const jamShift = op.jamShift?.trim() || "-"

  const teams = op.teams || {
    yangMenyerahkan: { danru: handover.profiles?.full_name || "", anggota1: "", anggota2: "" },
    yangMenerima: { danru: "", anggota1: "", anggota2: "" },
    mengetahui: { danru: handover.profiles?.full_name || "", spv: "" },
  }

  const newPage = () => {
    doc.addPage()
    y = MARGIN
  }

  const ensure = (height: number) => {
    if (y + height > pageBottom) newPage()
  }

  const setFont = (bold = false, size = BODY_SIZE) => {
    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setFontSize(size)
  }

  const wrapLine = (line: CellLine, width: number): CellLine[] => {
    setFont(line.bold)
    const parts = String(line.text ?? "-").split("\n")
    const output: CellLine[] = []
    parts.forEach((part) => {
      doc.splitTextToSize(part || "-", Math.max(4, width)).forEach((text: string) => {
        output.push({ text, bold: line.bold })
      })
    })
    return output
  }

  const prepareCells = (columns: Column[], cells: Cell[], defaultBold: boolean): CellLine[][] =>
    columns.map((column, index) => {
      const cell = cells[index]
      const raw: CellLine[] =
        typeof cell === "string" || cell == null
          ? [{ text: String(cell ?? "-"), bold: defaultBold }]
          : cell
      const lines: CellLine[] = []
      raw.forEach((line) => {
        lines.push(...wrapLine(line, column.width - PAD_X * 2))
      })
      if (lines.length === 0) lines.push({ text: "-", bold: defaultBold })
      return lines
    })

  const lineCount = (cells: CellLine[][]) => Math.max(1, ...cells.map((cell) => cell.length))
  const rowHeight = (cells: CellLine[][]) => lineCount(cells) * LINE_HEIGHT + PAD_Y * 2

  const drawLines = (lines: CellLine[], x: number, baseY: number, align: Align = "left", boxWidth = 0) => {
    lines.forEach((line, index) => {
      setFont(line.bold)
      const textY = baseY + PAD_Y + LINE_HEIGHT - 0.9 + index * LINE_HEIGHT
      if (align === "center") {
        doc.text(line.text, x + boxWidth / 2, textY, { align: "center" })
      } else if (align === "right") {
        doc.text(line.text, x + boxWidth - PAD_X, textY, { align: "right" })
      } else {
        doc.text(line.text, x, textY)
      }
    })
  }

  const drawCellsAt = (
    x: number,
    baseY: number,
    columns: Column[],
    cellLines: CellLine[][],
    start: number,
    count: number,
    fill?: [number, number, number]
  ) => {
    const height = count * LINE_HEIGHT + PAD_Y * 2
    const width = columns.reduce((sum, column) => sum + column.width, 0)
    if (fill) {
      doc.setFillColor(fill[0], fill[1], fill[2])
      doc.rect(x, baseY, width, height, "F")
    }
    let cellX = x
    columns.forEach((column, index) => {
      doc.rect(cellX, baseY, column.width, height)
      const lines = cellLines[index].slice(start, start + count)
      if (column.align === "center") {
        drawLines(lines, cellX, baseY, "center", column.width)
      } else if (column.align === "right") {
        drawLines(lines, cellX, baseY, "right", column.width)
      } else {
        drawLines(lines, cellX + PAD_X, baseY)
      }
      cellX += column.width
    })
  }

  const drawTitleBand = (title: string, x = MARGIN, width = CONTENT_WIDTH) => {
    setFont(true, 8)
    doc.setFillColor(SECTION_FILL[0], SECTION_FILL[1], SECTION_FILL[2])
    doc.rect(x, y, width, TITLE_BAND, "F")
    doc.rect(x, y, width, TITLE_BAND)
    doc.text(title, x + PAD_X, y + TITLE_BAND - 1.9)
    y += TITLE_BAND
  }

  const drawEmptyRow = (
    x: number,
    baseY: number,
    width: number,
    text: string,
    color: [number, number, number] = EMPTY_GRAY,
    height = LINE_HEIGHT + PAD_Y * 2
  ) => {
    doc.rect(x, baseY, width, height)
    setFont(false)
    doc.setFont("helvetica", "italic")
    doc.setTextColor(color[0], color[1], color[2])
    doc.text(text, x + width / 2, baseY + PAD_Y + LINE_HEIGHT - 0.9, { align: "center" })
    doc.setTextColor(0)
    return height
  }

  interface TableOptions {
    title?: string
    emptyText?: string
    emptyColor?: [number, number, number]
    showEmptyRow?: boolean
  }

  const renderTable = (columns: Column[], rows: Cell[][], options: TableOptions = {}) => {
    const headerLines = prepareCells(columns, columns.map((column) => column.header), true)
    const headerHeight = rowHeight(headerLines)
    const emptyHeight = LINE_HEIGHT + PAD_Y * 2

    if (options.title) {
      ensure(TITLE_BAND + headerHeight + (rows.length > 0 ? LINE_HEIGHT + PAD_Y * 2 : emptyHeight))
      drawTitleBand(options.title)
    } else {
      ensure(headerHeight + (rows.length > 0 ? LINE_HEIGHT + PAD_Y * 2 : emptyHeight))
    }

    const drawHeader = () => {
      drawCellsAt(MARGIN, y, columns, headerLines, 0, lineCount(headerLines), HEADER_FILL)
      y += headerHeight
    }
    drawHeader()

    if (rows.length === 0) {
      if (options.showEmptyRow !== false && options.emptyText) {
        y += drawEmptyRow(MARGIN, y, CONTENT_WIDTH, options.emptyText, options.emptyColor)
      }
      y += 3
      return
    }

    rows.forEach((row) => {
      const cellLines = prepareCells(columns, row, false)
      const total = lineCount(cellLines)
      let drawn = 0
      while (drawn < total) {
        if (pageBottom - y - PAD_Y * 2 < LINE_HEIGHT) {
          newPage()
          drawHeader()
        }
        const available = pageBottom - y - PAD_Y * 2
        const fit = Math.max(1, Math.floor(available / LINE_HEIGHT))
        const count = Math.min(fit, total - drawn)
        drawCellsAt(MARGIN, y, columns, cellLines, drawn, count)
        y += count * LINE_HEIGHT + PAD_Y * 2
        drawn += count
        if (drawn < total) {
          newPage()
          drawHeader()
        }
      }
    })
    y += 3
  }

  const measureBlockTable = (columns: Column[], rows: Cell[][], options: TableOptions = {}) => {
    const headerLines = prepareCells(columns, columns.map((column) => column.header), true)
    let height = (options.title ? TITLE_BAND : 0) + rowHeight(headerLines)
    if (rows.length === 0) {
      height += options.showEmptyRow !== false && options.emptyText ? LINE_HEIGHT + PAD_Y * 2 : 0
    } else {
      rows.forEach((row) => {
        height += rowHeight(prepareCells(columns, row, false))
      })
    }
    return height
  }

  const drawBlockTable = (
    baseY: number,
    x: number,
    width: number,
    columns: Column[],
    rows: Cell[][],
    options: TableOptions = {}
  ) => {
    let cursor = baseY
    if (options.title) {
      setFont(true, 8)
      doc.setFillColor(SECTION_FILL[0], SECTION_FILL[1], SECTION_FILL[2])
      doc.rect(x, cursor, width, TITLE_BAND, "F")
      doc.rect(x, cursor, width, TITLE_BAND)
      doc.text(options.title, x + PAD_X, cursor + TITLE_BAND - 1.9)
      cursor += TITLE_BAND
    }

    const headerLines = prepareCells(columns, columns.map((column) => column.header), true)
    const headerHeight = rowHeight(headerLines)
    drawCellsAt(x, cursor, columns, headerLines, 0, lineCount(headerLines), HEADER_FILL)
    cursor += headerHeight

    if (rows.length === 0) {
      if (options.showEmptyRow !== false && options.emptyText) {
        cursor += drawEmptyRow(x, cursor, width, options.emptyText, options.emptyColor)
      }
      return cursor - baseY
    }

    rows.forEach((row) => {
      const cellLines = prepareCells(columns, row, false)
      const height = rowHeight(cellLines)
      drawCellsAt(x, cursor, columns, cellLines, 0, lineCount(cellLines))
      cursor += height
    })
    return cursor - baseY
  }

  // Header with logos
  const [danantara, pertamina] = await Promise.all([getLogoAsset("/danantara.png"), getLogoAsset("/pertamina.png")])
  const headerTop = y
  const drawLogo = (logo: LogoAsset | null, alignRight: boolean, maxWidth: number, maxHeight: number) => {
    if (!logo) return
    const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height)
    const width = logo.width * scale
    const height = logo.height * scale
    const x = alignRight ? PAGE_WIDTH - MARGIN - width : MARGIN
    doc.addImage(logo.data, "PNG", x, headerTop, width, height)
  }
  drawLogo(danantara, false, 25, 14)
  drawLogo(pertamina, true, 25, 14)
  setFont(true, 11)
  doc.text("FORMULIR SERAH TERIMA SHIFT", PAGE_WIDTH / 2, headerTop + 8, { align: "center" })
  y = headerTop + 15

  // Meta table
  const labelWidth = CONTENT_WIDTH * 0.25
  const valueWidth = CONTENT_WIDTH - labelWidth
  const metaRows: Array<[string, string]> = [
    ["Hari / tanggal", longDate(handover.tanggal)],
    ["Regu Shift", shiftName],
    ["Jam Shift", jamShift],
  ]
  metaRows.forEach(([label, value]) => {
    const labelLines = wrapLine({ text: label, bold: true }, labelWidth - PAD_X * 2)
    const valueLines = wrapLine({ text: value, bold: false }, valueWidth - PAD_X * 2)
    const height = rowHeight([labelLines, valueLines])
    ensure(height)
    const top = y
    doc.setFillColor(HEADER_FILL[0], HEADER_FILL[1], HEADER_FILL[2])
    doc.rect(MARGIN, top, labelWidth, height, "F")
    doc.rect(MARGIN, top, labelWidth, height)
    doc.rect(MARGIN + labelWidth, top, valueWidth, height)
    drawLines(labelLines, MARGIN + PAD_X, top)
    drawLines(valueLines, MARGIN + labelWidth + PAD_X, top)
    y += height
  })
  y += 4

  // Activities
  const activityColumns: Column[] = [
    { header: "Pukul", width: 18, align: "center" },
    { header: "Detail Kegiatan / Aktifitas", width: CONTENT_WIDTH - 18, align: "left" },
  ]
  const activityRows: Cell[][] = activities.map((activity) => {
    const subs = activity.deskripsi
      ? activity.deskripsi.split(". ").filter((s) => s.trim() && s.trim() !== activity.aktivitas)
      : []
    const detail: CellLine[] = [{ text: activity.aktivitas || "-", bold: true }]
    subs.forEach((sub) => detail.push({ text: `• ${sub.trim()}`, bold: false }))
    return [[{ text: formatTime(activity.waktu), bold: true }], detail]
  })
  renderTable(activityColumns, activityRows, {
    title: "Detail Kegiatan / Aktifitas",
    emptyText: "Tidak ada catatan kegiatan shift",
    emptyColor: [107, 114, 128],
  })

  // Tank levels
  const tankColumns: Column[] = [
    { header: "JAM", width: 16, align: "center" },
    { header: "PRODUK", width: 38, align: "center" },
    { header: "No.Tanki", width: 22, align: "center" },
    { header: "LEVEL", width: 24, align: "center" },
    { header: "WATER", width: 24, align: "center" },
    { header: "Keterangan", width: CONTENT_WIDTH - 16 - 38 - 22 - 24 - 24, align: "left" },
  ]
  renderTable(
    tankColumns,
    (op.tankLevels || []).map((row) => [
      formatTime(row.jam),
      row.produk || "-",
      row.noTanki || "-",
      row.level || "-",
      row.water || "-",
      row.keterangan || "-",
    ]),
    { title: "Pengukuran Manual Level dan Water Tangki Timbun", emptyText: "Belum ada data pengukuran manual tangki" }
  )

  // QC
  const qcColumns: Column[] = [
    { header: "No. Sarfas", width: 26, align: "center" },
    { header: "Visual", width: 24, align: "center" },
    { header: "Density", width: 24, align: "center" },
    { header: "Temperatur", width: 28, align: "center" },
    { header: "Keterangan", width: CONTENT_WIDTH - 26 - 24 - 24 - 28, align: "left" },
  ]
  renderTable(
    qcColumns,
    (op.qcChecks || []).map((row) => [
      row.noSarfas || "-",
      row.visual || "-",
      row.density || "-",
      row.temperatur || "-",
      row.keterangan || "-",
    ]),
    { title: "Pemeriksaan Quality Control", emptyText: "Belum ada data QC" }
  )

  // Critical equipment (grouped by category, like the document)
  const criticalColumns: Column[] = [
    { header: "Kategori", width: 25, align: "left" },
    { header: "Nama Peralatan", width: 70, align: "left" },
    { header: "Status", width: 16, align: "center" },
    { header: "Kondisi", width: 24, align: "center" },
    { header: "Keterangan", width: CONTENT_WIDTH - 25 - 70 - 16 - 24, align: "left" },
  ]
  const restCriticalColumns = criticalColumns.slice(1)
  const criticalItems = op.criticalEquipment || []
  const groups = [
    { name: "Penerimaan", rows: criticalItems.filter((item) => item.kategori === "Penerimaan") },
    { name: "Penimbunan", rows: criticalItems.filter((item) => item.kategori === "Penimbunan") },
    { name: "Penyaluran", rows: criticalItems.filter((item) => item.kategori === "Penyaluran") },
  ].filter((group) => group.rows.length > 0)

  if (groups.length === 0) {
    renderTable(criticalColumns, [], { title: "Pemeriksaan Peralatan Operasi Kritikal", emptyText: "Belum ada data peralatan kritikal" })
  } else {
    const criticalHeaderLines = prepareCells(criticalColumns, criticalColumns.map((column) => column.header), true)
    const criticalHeaderHeight = rowHeight(criticalHeaderLines)
    const preparedGroups = groups.map((group) => ({
      name: group.name,
      rows: group.rows.map((item) => ({
        cellLines: prepareCells(restCriticalColumns, [
          item.namaPeralatan || "-",
          [{ text: item.status || "-", bold: true }],
          item.kondisi || "-",
          item.keterangan || "-",
        ], false),
      })),
    }))
    const groupsHeight = preparedGroups.reduce(
      (sum, group) => sum + group.rows.reduce((rowSum, row) => rowSum + rowHeight(row.cellLines), 0),
      0
    )
    const blockHeight = TITLE_BAND + criticalHeaderHeight + groupsHeight + 3

    if (blockHeight > pageBottom - MARGIN) {
      renderTable(
        criticalColumns,
        criticalItems.map((item) => [
          item.kategori || "-",
          item.namaPeralatan || "-",
          [{ text: item.status || "-", bold: true }],
          item.kondisi || "-",
          item.keterangan || "-",
        ]),
        { title: "Pemeriksaan Peralatan Operasi Kritikal" }
      )
    } else {
      ensure(blockHeight)
      drawTitleBand("Pemeriksaan Peralatan Operasi Kritikal")
      drawCellsAt(MARGIN, y, criticalColumns, criticalHeaderLines, 0, lineCount(criticalHeaderLines), HEADER_FILL)
      y += criticalHeaderHeight

      preparedGroups.forEach((group) => {
        const groupHeight = group.rows.reduce((sum, row) => sum + rowHeight(row.cellLines), 0)
        const groupTop = y
        doc.setFillColor(GROUP_FILL[0], GROUP_FILL[1], GROUP_FILL[2])
        doc.rect(MARGIN, groupTop, criticalColumns[0].width, groupHeight, "F")
        doc.rect(MARGIN, groupTop, criticalColumns[0].width, groupHeight)
        setFont(true)
        doc.text(group.name, MARGIN + PAD_X, groupTop + PAD_Y + LINE_HEIGHT - 0.9)

        group.rows.forEach((row) => {
          const height = rowHeight(row.cellLines)
          drawCellsAt(MARGIN + criticalColumns[0].width, y, restCriticalColumns, row.cellLines, 0, lineCount(row.cellLines))
          y += height
        })
      })
      y += 3
    }
  }

  // Safety tools + transfer requests side by side
  const gap = 4
  const halfWidth = (CONTENT_WIDTH - gap) / 2
  const safetyColumns: Column[] = [
    { header: "Nama", width: 33, align: "left" },
    { header: "Status", width: 16, align: "center" },
    { header: "Kondisi", width: 16, align: "center" },
    { header: "Keterangan", width: halfWidth - 33 - 16 - 16, align: "left" },
  ]
  const transferColumns: Column[] = [
    { header: "No", width: 10, align: "center" },
    { header: "Produk", width: 28, align: "left" },
    { header: "Jumlah", width: 16, align: "center" },
    { header: "Keterangan", width: halfWidth - 10 - 28 - 16, align: "left" },
  ]
  const safetyRows: Cell[][] = (op.safetyTools || []).map((tool) => [
    tool.nama || "-",
    [{ text: tool.status || "-", bold: true }],
    tool.kondisi || "-",
    tool.keterangan || "-",
  ])
  const transferRows: Cell[][] = (op.transferRequests || []).map((request) => [
    request.noTangki || "-",
    request.namaProduk || "-",
    `${request.estJumlahKL ?? "-"} KL`,
    request.keterangan || "-",
  ])
  const safetyOptions: TableOptions = {
    title: "Pemeriksaan Perlengkapan Safety",
    emptyText: "",
    showEmptyRow: false,
  }
  const transferOptions: TableOptions = {
    title: "Permintaan Transfer Tangki",
    emptyText: "Tidak ada permintaan transfer",
  }
  const safetyHeight = measureBlockTable(safetyColumns, safetyRows, safetyOptions)
  const transferHeight = measureBlockTable(transferColumns, transferRows, transferOptions)
  const combinedHeight = Math.max(safetyHeight, transferHeight)

  if (combinedHeight <= pageBottom - MARGIN) {
    ensure(combinedHeight)
    const baseY = y
    drawBlockTable(baseY, MARGIN, halfWidth, safetyColumns, safetyRows, safetyOptions)
    drawBlockTable(baseY, MARGIN + halfWidth + gap, halfWidth, transferColumns, transferRows, transferOptions)
    y = baseY + combinedHeight + 3
  } else {
    renderTable(safetyColumns, safetyRows, safetyOptions)
    renderTable(transferColumns, transferRows, transferOptions)
  }

  // Receiving tanks
  const receivingColumns: Column[] = [
    { header: "No", width: 18, align: "center" },
    { header: "Produk", width: 60, align: "left" },
    { header: "Jumlah", width: 28, align: "center" },
    { header: "Keterangan", width: CONTENT_WIDTH - 18 - 60 - 28, align: "left" },
  ]
  renderTable(
    receivingColumns,
    (op.receivingTanks || []).map((tank) => [
      tank.noTangki || "-",
      tank.namaProduk || "-",
      `${tank.estJumlahKL ?? "-"} KL`,
      tank.keterangan || "-",
    ]),
    { title: "Tangki Penerimaan", emptyText: "Tidak ada data tangki penerimaan" }
  )

  // Signatures
  const signatureHeight = 58
  ensure(signatureHeight)
  const boxTop = y
  const half = CONTENT_WIDTH / 2
  doc.rect(MARGIN, boxTop, CONTENT_WIDTH, signatureHeight)

  doc.setFillColor(HEADER_FILL[0], HEADER_FILL[1], HEADER_FILL[2])
  doc.rect(MARGIN, boxTop, half, 7, "F")
  doc.rect(MARGIN + half, boxTop, half, 7, "F")
  doc.rect(MARGIN, boxTop, CONTENT_WIDTH, 7)
  setFont(true)
  doc.text(`Yang Menyerahkan (Shift / Jam: ${shiftName})`, MARGIN + half / 2, boxTop + 4.6, { align: "center" })
  doc.text("Yang Menerima (Shift / Jam)", MARGIN + half + half / 2, boxTop + 4.6, { align: "center" })

  const leftRows: Array<[string, string]> = [
    ["Pws / Danru Shift", teams.yangMenyerahkan?.danru || "-"],
    ["Anggota 1", teams.yangMenyerahkan?.anggota1 || "-"],
    ["Anggota 2", teams.yangMenyerahkan?.anggota2 || "-"],
  ]
  const rightRows: Array<[string, string]> = [
    ["Pws / Danru Shift", teams.yangMenerima?.danru || "-"],
    ["Anggota 1", teams.yangMenerima?.anggota1 || "-"],
    ["Anggota 2", teams.yangMenerima?.anggota2 || "-"],
  ]
  leftRows.forEach(([label, value], index) => {
    const lineY = boxTop + 11 + index * 5
    setFont(true)
    doc.text(`${label}:`, MARGIN + 4, lineY)
    setFont(false)
    doc.text(value, MARGIN + half - 4, lineY, { align: "right" })
  })
  rightRows.forEach(([label, value], index) => {
    const lineY = boxTop + 11 + index * 5
    setFont(true)
    doc.text(`${label}:`, MARGIN + half + 4, lineY)
    setFont(false)
    doc.text(value, MARGIN + CONTENT_WIDTH - 4, lineY, { align: "right" })
  })

  doc.line(MARGIN, boxTop + 26, MARGIN + CONTENT_WIDTH, boxTop + 26)
  doc.setFillColor(HEADER_FILL[0], HEADER_FILL[1], HEADER_FILL[2])
  doc.rect(MARGIN, boxTop + 26, CONTENT_WIDTH, 7, "F")
  doc.rect(MARGIN, boxTop + 26, CONTENT_WIDTH, 7)
  setFont(true)
  doc.text("Mengetahui", PAGE_WIDTH / 2, boxTop + 30.6, { align: "center" })

  setFont(false)
  doc.text("Danru", MARGIN + half / 2, boxTop + 38.5, { align: "center" })
  doc.text("Sr. Spv II Fuel & LPG RSD", MARGIN + half + half / 2, boxTop + 38.5, { align: "center" })
  doc.line(MARGIN + 10, boxTop + 40.5, MARGIN + half - 10, boxTop + 40.5)
  doc.line(MARGIN + half + 10, boxTop + 40.5, MARGIN + CONTENT_WIDTH - 10, boxTop + 40.5)

  setFont(true)
  doc.text(teams.mengetahui?.danru || teams.yangMenyerahkan?.danru || "-", MARGIN + half / 2, boxTop + 53, { align: "center" })
  doc.text(teams.mengetahui?.spv || "", MARGIN + half + half / 2, boxTop + 53, { align: "center" })
  y = boxTop + signatureHeight + 2

  // Footer notes
  ensure(10)
  setFont(false)
  doc.setFont("helvetica", "italic")
  doc.setFontSize(6.5)
  doc.setTextColor(110)
  doc.text("* Catatan: dapat disertakan lampiran formulir-formulir atau dokumen catatan lain yang terkait.", PAGE_WIDTH / 2, y + 3, {
    align: "center",
  })
  doc.text(
    "* Dokumen ini dinyatakan sah walaupun tanpa tanda tangan pejabat ybs, karena dicetak dari sistem Shift Handover Online.",
    PAGE_WIDTH / 2,
    y + 6.5,
    { align: "center" }
  )
  doc.setTextColor(0)
}

export async function buildHandoverPdf(handover: PdfHandover, activities: PdfActivity[] = []): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  await renderHandoverPdf(doc, handover, activities)
  return doc
}
