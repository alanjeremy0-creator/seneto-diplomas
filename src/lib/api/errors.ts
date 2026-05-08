import { NextResponse } from 'next/server'

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message)
  }
}

export const Errors = {
  UNAUTHORIZED: () => new ApiError('UNAUTHORIZED', 'No autorizado', 401),
  FORBIDDEN: () => new ApiError('FORBIDDEN', 'Acceso denegado', 403),
  NOT_FOUND: (resource = 'Recurso') =>
    new ApiError('NOT_FOUND', `${resource} no encontrado`, 404),
  VALIDATION: (message: string) => new ApiError('VALIDATION_ERROR', message, 400),
  CONFLICT: (message: string) => new ApiError('CONFLICT', message, 409),
  INTERNAL: () => new ApiError('INTERNAL_ERROR', 'Error interno del servidor', 500),
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status }
    )
  }
  console.error('[API Error]', error)
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
    { status: 500 }
  )
}
