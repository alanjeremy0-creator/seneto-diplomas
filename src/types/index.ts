export type CertificateStatus = 'pending' | 'active' | 'revoked' | 'expired'
export type GenerationStatus = 'draft' | 'ready' | 'processing' | 'completed' | 'failed'
export type UserRole = 'superadmin' | 'admin'
export type ErrorType = 'missing_photo' | 'invalid_data' | 'render_error'

export interface FieldZone {
  x: number
  y: number
  width: number
  height: number
  fontSize?: number
  fontSizeMin?: number
  fontColor?: string
  fontFamily?: string
  fontWeight?: string
  fontStyle?: string
  align?: 'left' | 'center' | 'right'
}

export interface QRZone {
  x: number
  y: number
  size: number
}

export interface FieldZones {
  name: FieldZone
  photo: FieldZone
  qr: QRZone
  folio?: FieldZone
  date?: FieldZone
  program?: FieldZone
}

export interface User {
  id: string
  email: string
  role: UserRole
  created_at: Date
  last_login_at?: Date
}

export interface Template {
  id: string
  name: string
  file_path?: string
  image_width_px?: number
  image_height_px?: number
  field_zones?: FieldZones
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface Generation {
  id: string
  name: string
  template_id: string
  status: GenerationStatus
  folio_prefix: string
  folio_year: number
  folio_counter: number
  total_count: number
  processed_count: number
  error_count: number
  csv_path?: string
  photos_zip_path?: string
  zip_path?: string
  created_by: string
  created_at: Date
  updated_at: Date
}

export interface Certificate {
  id: string
  folio: string
  verification_token: string
  generation_id: string
  student_name: string
  // email existe en BD pero no se expone en respuestas públicas ni en VerifyResponse
  email?: string
  program?: string
  issued_date?: Date
  status: CertificateStatus
  photo_path?: string
  diploma_pdf_path?: string
  diploma_png_path?: string
  error_message?: string
  created_at: Date
  updated_at: Date
  revoked_at?: Date
  revocation_reason?: string
}

export interface GenerationError {
  id: string
  generation_id: string
  student_name?: string
  row_number?: number
  error_type: ErrorType
  error_detail?: string
  created_at: Date
}

// MVP: photos matched by folio (filename = folio), not by archivo_foto column
export interface StudentCSVRow {
  student_name?: string
  email?: string
  program?: string
  issued_date?: string
  archivo_foto?: string
  folio_override?: string
}
