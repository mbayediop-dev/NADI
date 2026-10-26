import "server-only"
import ExcelJS from "exceljs"

export type SheetColumn<T> = { header: string; key: string; width?: number; value: (row: T) => string | number | Date | boolean | null | undefined; numFmt?: string }

export const MONEY_FMT = '#,##0 "FCFA"'
export const DATE_FMT = "dd/mm/yyyy"

/** Crée un classeur Excel stylé (en-têtes colorés, colonnes figées, filtres). */
export async function buildWorkbook<T>(sheets: { name: string; columns: SheetColumn<T>[]; rows: T[] }[]) {
  const wb = new ExcelJS.Workbook()
  wb.creator = "NADI Group"
  wb.created = new Date()
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] })
    ws.columns = sheet.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? Math.max(12, c.header.length + 4), style: c.numFmt ? { numFmt: c.numFmt } : undefined }))
    for (const row of sheet.rows) {
      ws.addRow(Object.fromEntries(sheet.columns.map((c) => [c.key, c.value(row) ?? null])))
    }
    const header = ws.getRow(1)
    header.font = { bold: true, color: { argb: "FFFFFFFF" } }
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E4D42" } }
    header.alignment = { vertical: "middle" }
    header.height = 22
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } }
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}

export function xlsxResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  })
}

/** Lit la première feuille d'un fichier Excel : renvoie les lignes sous forme d'objets {entête: valeur}. */
export async function readFirstSheet(data: ArrayBuffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(data)
  const ws = wb.worksheets[0]
  if (!ws) return { headers: [] as string[], rows: [] as Record<string, unknown>[] }
  const headers: string[] = []
  ws.getRow(1).eachCell((cell, col) => (headers[col - 1] = String(cell.text ?? "").trim()))
  const rows: Record<string, unknown>[] = []
  ws.eachRow((row, index) => {
    if (index === 1) return
    const record: Record<string, unknown> = {}
    let empty = true
    headers.forEach((h, i) => {
      const cell = row.getCell(i + 1)
      let value: unknown = cell.value
      if (value && typeof value === "object" && "result" in (value as object)) value = (value as { result: unknown }).result
      if (value && typeof value === "object" && "richText" in (value as object)) value = cell.text
      if (value !== null && value !== undefined && value !== "") empty = false
      record[h] = value
    })
    if (!empty) rows.push(record)
  })
  return { headers, rows }
}
