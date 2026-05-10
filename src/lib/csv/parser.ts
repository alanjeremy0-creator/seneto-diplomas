import type { StudentCSVRow } from '@/types'

export const FOLIO_OVERRIDE_RE = /^[A-Z]{2,10}-\d{4}-\d{1,6}$/

// Strip leading formula-injection prefixes (=, +, -, @) to prevent CSV injection
// when these fields are later exported to spreadsheets.
function sanitizeTextField(value: string): string {
  return value.replace(/^[=+\-@]+/, '').trim()
}

const ALLOWED_COLUMNS = new Set([
  'student_name',
  'program',
  'issued_date',
  'folio_override',
])

export interface ParsedRow {
  row_number: number
  data: StudentCSVRow
}

export interface ParseError {
  row_number: number
  student_name?: string
  error_detail: string
}

export interface CsvParseResult {
  rows: ParsedRow[]
  errors: ParseError[]
}

function splitCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  values.push(current.trim())
  return values
}

// Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, DD-MM-YY.
// Interprets ambiguous 2-part separators as DD/MM order (never MM/DD).
// Returns normalized YYYY-MM-DD string, or null if invalid.
function parseFlexibleDate(raw: string): string | null {
  let year: number, month: number, day: number

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    year  = parseInt(isoMatch[1], 10)
    month = parseInt(isoMatch[2], 10)
    day   = parseInt(isoMatch[3], 10)
  } else {
    const dmyMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
    if (!dmyMatch) return null
    day   = parseInt(dmyMatch[1], 10)
    month = parseInt(dmyMatch[2], 10)
    const yr = parseInt(dmyMatch[3], 10)
    year = dmyMatch[3].length === 2
      ? (yr <= 69 ? 2000 + yr : 1900 + yr)
      : yr
  }

  if (month < 1 || month > 12) return null
  if (day   < 1) return null
  // new Date(year, month, 0) gives the last day of month
  if (day > new Date(year, month, 0).getDate()) return null

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseCsv(csvText: string): CsvParseResult {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== '')

  if (lines.length === 0) {
    return { rows: [], errors: [] }
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim())
  const nameIdx = headers.indexOf('student_name')

  if (nameIdx === -1) {
    return {
      rows: [],
      errors: [{ row_number: 1, error_detail: 'Columna student_name requerida no encontrada' }],
    }
  }

  const colIndex = (col: string) => {
    const idx = headers.indexOf(col)
    return idx === -1 ? null : idx
  }

  const programIdx = colIndex('program')
  const issuedDateIdx = colIndex('issued_date')
  const folioOverrideIdx = colIndex('folio_override')

  const rows: ParsedRow[] = []
  const errors: ParseError[] = []
  const seenFolioOverrides = new Set<string>()

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1
    const values = splitCsvLine(lines[i])

    // Skip rows where every field is empty (e.g. trailing ",,")
    if (values.every((v) => v.trim() === '')) continue

    const student_name = nameIdx !== null ? (values[nameIdx] ?? '').trim() : ''

    if (!student_name) {
      errors.push({ row_number: rowNumber, error_detail: 'student_name vacío' })
      continue
    }

    const folio_override =
      folioOverrideIdx !== null ? (values[folioOverrideIdx] ?? '').trim() : ''

    if (folio_override && !FOLIO_OVERRIDE_RE.test(folio_override)) {
      errors.push({
        row_number: rowNumber,
        student_name,
        error_detail: `folio_override inválido: "${folio_override}"`,
      })
      continue
    }

    if (folio_override) {
      if (seenFolioOverrides.has(folio_override)) {
        errors.push({
          row_number: rowNumber,
          student_name,
          error_detail: `folio_override duplicado en el CSV: "${folio_override}"`,
        })
        continue
      }
      seenFolioOverrides.add(folio_override)
    }

    const issued_date_raw =
      issuedDateIdx !== null ? (values[issuedDateIdx] ?? '').trim() : ''

    let issued_date: string | undefined
    if (issued_date_raw) {
      const parsed = parseFlexibleDate(issued_date_raw)
      if (!parsed) {
        errors.push({
          row_number: rowNumber,
          student_name,
          error_detail: `issued_date inválida: "${issued_date_raw}". Usa una fecha válida como 2026-06-10 o 10/06/2026.`,
        })
        continue
      }
      issued_date = parsed
    }

    const program = programIdx !== null
      ? sanitizeTextField((values[programIdx] ?? '').trim()) || undefined
      : undefined

    const data: StudentCSVRow = {
      student_name: sanitizeTextField(student_name),
      program,
      issued_date,
      folio_override: folio_override || undefined,
    }

    rows.push({ row_number: rowNumber, data })
  }

  return { rows, errors }
}
