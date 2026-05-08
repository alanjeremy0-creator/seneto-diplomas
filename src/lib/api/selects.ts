// Shared safe Prisma select shapes for API responses.
// These constants NEVER include internal storage paths (csv_path, photos_zip_path,
// zip_path, file_path, photo_path, diploma_pdf_path, diploma_png_path).
// Import these in every route that returns generation or template data to clients.

export const SAFE_GENERATION_SELECT = {
  id: true,
  name: true,
  status: true,
  folio_prefix: true,
  folio_year: true,
  folio_counter: true,
  total_count: true,
  processed_count: true,
  error_count: true,
  created_by: true,
  created_at: true,
  updated_at: true,
  template: {
    select: { id: true, name: true },
  },
} as const

// Like SAFE_GENERATION_SELECT but includes template.field_zones for detail/edit views
// (Zone Editor in Sprint 2 needs the zone coordinates to render the canvas state).
export const SAFE_GENERATION_DETAIL_SELECT = {
  id: true,
  name: true,
  status: true,
  folio_prefix: true,
  folio_year: true,
  folio_counter: true,
  total_count: true,
  processed_count: true,
  error_count: true,
  created_by: true,
  created_at: true,
  updated_at: true,
  template: {
    select: { id: true, name: true, field_zones: true, image_width_px: true, image_height_px: true },
  },
} as const

export const SAFE_TEMPLATE_SELECT = {
  id: true,
  name: true,
  image_width_px: true,
  image_height_px: true,
  field_zones: true,
} as const
