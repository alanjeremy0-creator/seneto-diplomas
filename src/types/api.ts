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
