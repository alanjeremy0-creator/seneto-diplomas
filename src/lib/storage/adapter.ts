export interface StorageAdapter {
  put(path: string, buffer: Buffer): Promise<void>
  get(path: string): Promise<Buffer>
  delete(path: string): Promise<void>
  exists(path: string): Promise<boolean>
  url(path: string): string
}

import fs from 'fs/promises'
import path from 'path'

export class LocalStorage implements StorageAdapter {
  private base: string

  constructor(basePath: string) {
    this.base = basePath
  }

  private resolve(p: string) {
    const base = path.resolve(this.base)
    const resolved = path.resolve(base, p)
    if (resolved !== base && !resolved.startsWith(base + path.sep)) {
      throw new Error(`Path traversal attempt: ${p}`)
    }
    return resolved
  }

  async put(p: string, buffer: Buffer): Promise<void> {
    const full = this.resolve(p)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, buffer)
  }

  async get(p: string): Promise<Buffer> {
    return fs.readFile(this.resolve(p))
  }

  async delete(p: string): Promise<void> {
    await fs.unlink(this.resolve(p))
  }

  async exists(p: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(p))
      return true
    } catch {
      return false
    }
  }

  url(p: string): string {
    return `/api/files/${p}`
  }
}

const storagePath = process.env.STORAGE_PATH ?? './storage'
export const storage = new LocalStorage(storagePath)
