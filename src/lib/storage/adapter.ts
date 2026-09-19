export interface StorageAdapter {
  put(path: string, buffer: Buffer): Promise<void>
  get(path: string): Promise<Buffer>
  delete(path: string): Promise<void>
  exists(path: string): Promise<boolean>
  url(path: string): string
  putStream(path: string, stream: Readable): Promise<void>
  getStream(path: string): Readable
  size(path: string): Promise<number>
}

import fs from 'fs/promises'
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import type { Readable } from 'stream'
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

  // Escribe a un archivo temporal y lo renombra al terminar, para que un
  // proceso que muere a mitad de la escritura no deje un archivo truncado.
  async putStream(p: string, stream: Readable): Promise<void> {
    const full = this.resolve(p)
    const tmp = `${full}.tmp`
    await fs.mkdir(path.dirname(full), { recursive: true })
    try {
      await pipeline(stream, createWriteStream(tmp))
      await fs.rename(tmp, full)
    } catch (err) {
      await fs.unlink(tmp).catch(() => {})
      throw err
    }
  }

  getStream(p: string): Readable {
    return createReadStream(this.resolve(p))
  }

  async size(p: string): Promise<number> {
    return (await fs.stat(this.resolve(p))).size
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
