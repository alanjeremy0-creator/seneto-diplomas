import { Prisma } from '@prisma/client'
import { prisma } from '../db'

interface LogActionParams {
  userId?: string
  action: string
  targetId?: string
  targetType?: string
  detail?: Prisma.InputJsonValue
  ip?: string
}

export async function logAction(params: LogActionParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: params.userId ?? null,
        action: params.action,
        target_id: params.targetId ?? null,
        target_type: params.targetType ?? null,
        detail: params.detail,
        ip: params.ip ?? null,
      },
    })
  } catch (error) {
    console.error('[audit] logAction failed — flujo principal no interrumpido:', error)
  }
}
