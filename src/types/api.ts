import type {
  Certificate,
  CertificateStatus,
  FieldZones,
  Generation,
  GenerationStatus,
  Template,
  User,
} from './index'

export interface ApiError {
  error: {
    code: string
    message: string
  }
}

// Auth
export interface LoginRequest { email: string; password: string }
export interface LoginResponse { user: Omit<User, 'password_hash'> }

// Templates
export interface TemplateCreateRequest { name: string }
export interface TemplateUpdateRequest { name?: string; field_zones?: FieldZones }
export type TemplateResponse = Template

// Generations
export interface GenerationCreateRequest {
  name: string
  template_id?: string
  folio_prefix?: string
  folio_year?: number
  folio_counter?: number
}
export interface GenerationUpdateRequest { name?: string; template_id?: string; field_zones?: FieldZones }
export type GenerationResponse = Generation & { template?: Template }

// CSV Upload
export interface CSVPreviewRow { [key: string]: string }
export interface CSVUploadResponse {
  total: number
  preview: CSVPreviewRow[]
  errors: Array<{ row: number; message: string }>
  missing_columns: string[]
}

// Photos Upload
export interface PhotosUploadResponse {
  total_uploaded: number
  matched: number
  unmatched_photos: string[]
  students_without_photo: string[]
}

// Validate
export interface ValidationIssue {
  type: 'missing_photo' | 'name_too_long' | 'missing_field' | 'invalid_date'
  student_name?: string
  row?: number
  detail: string
}
export interface ValidateResponse {
  ready: boolean
  issues: ValidationIssue[]
  can_proceed: boolean
}

// Generate
export interface GenerateResponse { generation_id: string; status: GenerationStatus }
export interface StatusResponse {
  status: GenerationStatus
  total: number
  processed: number
  errors: number
  zip_ready: boolean
}

// Certificates
export interface CertificatePatchRequest {
  status: CertificateStatus
  revocation_reason?: string
}
export interface CertificateSearchResponse {
  certificates: Certificate[]
  total: number
}

// Public verify — política MVP: solo campos aprobados por PROJECT_EXECUTION_PLAN.md §7.3
// No incluir: photo_url (pendiente aprobación Seneto), email, token, ni IDs internos
export interface VerifyResponse {
  valid: boolean
  status: CertificateStatus
  folio: string
  student_name?: string
  program?: string
  issued_date?: string | null
  institution: string
  message: string
}

// ── FE-012 / FE-013 safe view-layer types ────────────────────────────────────
// These types match exactly what GET /api/certificates and
// GET /api/certificates/[folio] return after stripping internal fields.
// NEVER add: verification_token, photo_path, diploma_pdf_path,
//            diploma_png_path, email, or raw storage paths.

export interface CertificateGenerationRef {
  id: string
  name: string
  folio_prefix: string
  folio_year: number
}

/** Shape returned by GET /api/certificates (list item). */
export interface CertificateListItem {
  /** Internal DB id — never render in UI */
  id: string
  folio: string
  student_name: string
  program?: string | null
  issued_date?: string | Date | null
  status: CertificateStatus
  has_photo: boolean
  created_at: string | Date
  updated_at: string | Date
  generation: CertificateGenerationRef
}

/** Shape returned by GET /api/certificates/[folio] (detail). */
export interface CertificateDetailItem extends CertificateListItem {
  revoked_at?: string | Date | null
  revocation_reason?: string | null
  // generation_id intentionally omitted — use generation.id if needed
}

export interface CertificateListResponse {
  certificates: CertificateListItem[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export interface CertificateDetailResponse {
  certificate: CertificateDetailItem
}
