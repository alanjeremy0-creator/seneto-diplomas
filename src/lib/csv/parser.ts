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
    const issued_date = issued_date_raw || undefined

    if (issued_date && !/^\d{4}-\d{2}-\d{2}$/.test(issued_date)) {
      errors.push({
        row_number: rowNumber,
        student_name,
        error_detail: `issued_date inválida: "${issued_date}" (se espera YYYY-MM-DD)`,
      })
      continue
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
