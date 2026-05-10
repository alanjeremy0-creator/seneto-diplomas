/**
 * Smoke test — S3A-004: Diploma Generation Engine
 * Run with: npx tsx scripts/smoke-engine.ts
 */

import 'dotenv/config'

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run in production')
}

// Mock base URL for testing
process.env.PUBLIC_VERIFY_BASE_URL = process.env.PUBLIC_VERIFY_BASE_URL ?? 'http://localhost:3000'

import { prisma } from '../src/lib/db'
import { storage } from '../src/lib/storage/adapter'
import { runGenerationEngine } from '../src/lib/diploma/engine'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'

// Unique IDs for testing
const SUFFIX = Date.now().toString()
const USER_ID = `SMOKE-USER-${SUFFIX}`
const TEMPLATE_ID = `SMOKE-TEMPLATE-${SUFFIX}`
const GEN_ID = `SMOKE-GEN-${SUFFIX}`
const CERT_ID_1 = `SMOKE-CERT-${SUFFIX}`
const FOLIO = `SMOKE-FOLIO-${SUFFIX}`

async function makeTemplatePng() {
  const buf = await sharp({
    create: { width: 2000, height: 1414, channels: 4, background: { r: 240, g: 240, b: 240, alpha: 1 } }
  }).png().toBuffer()
  return buf
}

async function cleanupDb() {
  await prisma.generationError.deleteMany({ where: { generation_id: GEN_ID } })
  await prisma.certificate.deleteMany({ where: { generation_id: GEN_ID } })
  await prisma.generation.deleteMany({ where: { id: GEN_ID } })
  await prisma.template.deleteMany({ where: { id: TEMPLATE_ID } })
  await prisma.user.deleteMany({ where: { id: USER_ID } })
}

async function cleanupStorage() {
  const dirs = [
    `templates/${TEMPLATE_ID}`,
    `diplomas/${GEN_ID}`,
    `zips/${GEN_ID}`
  ]
  for (const dir of dirs) {
    // Note: LocalStorage adapter doesn't have a rmdir method, so we delete individual files or use fs manually if path is known.
    // Given the test is local, we can cheat a bit and remove the dir directly or rely on cleaning up known files.
  }
  // Try to use storage.delete on known files
  await storage.delete(`templates/${TEMPLATE_ID}/template.png`).catch(() => {})
  await storage.delete(`diplomas/${GEN_ID}/${FOLIO}.png`).catch(() => {})
  await storage.delete(`diplomas/${GEN_ID}/${FOLIO}.pdf`).catch(() => {})
  await storage.delete(`zips/${GEN_ID}/diplomas.zip`).catch(() => {})
}

async function setup() {
  await cleanupDb()
  await cleanupStorage()

  // 1. Create User
  await prisma.user.create({
    data: {
      id: USER_ID,
      email: 'smoke@example.com',
      password_hash: 'not-a-real-hash',
      role: 'admin'
    }
  })

  // 2. Create Template
  const templatePath = `templates/${TEMPLATE_ID}/template.png`
  await storage.put(templatePath, await makeTemplatePng())
  
  await prisma.template.create({
    data: {
      id: TEMPLATE_ID,
      name: 'Smoke Template',
      file_path: templatePath,
      image_width_px: 2000,
      image_height_px: 1414
    }
  })

  // 3. Create Generation
  await prisma.generation.create({
    data: {
      id: GEN_ID,
      name: 'Smoke Generation',
      template_id: TEMPLATE_ID,
      created_by: USER_ID,
      status: 'processing',
      folio_prefix: 'SMOKE',
      folio_year: 2026,
      folio_counter: 1,
      total_count: 1,
      processed_count: 0,
      error_count: 0
    }
  })

  // 4. Create Certificate
  await prisma.certificate.create({
    data: {
      id: CERT_ID_1,
      folio: FOLIO,
      verification_token: randomUUID(),
      generation_id: GEN_ID,
      student_name: 'Smoke Student',
      status: 'pending'
    }
  })
}

async function run() {
  console.log('\\n── S3A-004 Engine smoke test ────────────────────────\\n')
  
  try {
    console.log('1. Setting up mock data...')
    await setup()

    console.log('2. Running runGenerationEngine()...')
    await runGenerationEngine(GEN_ID)

    console.log('3. Asserting database state...')
    const gen = await prisma.generation.findUnique({ where: { id: GEN_ID } })
    if (gen?.status !== 'completed') {
      const errors = await prisma.generationError.findMany({ where: { generation_id: GEN_ID } })
      console.error('Generation errors:', errors)
      throw new Error(`Expected generation status completed, got ${gen?.status}`)
    }
    if (gen?.processed_count !== 1) throw new Error(`Expected processed_count 1, got ${gen?.processed_count}`)
    if (!gen?.zip_path) throw new Error('Generation zip_path is missing')

    const cert = await prisma.certificate.findUnique({ where: { id: CERT_ID_1 } })
    if (cert?.status !== 'active') {
      console.error('Cert error:', cert?.error_message)
      throw new Error(`Expected certificate status active, got ${cert?.status}`)
    }
    if (!cert?.diploma_png_path) throw new Error('Certificate diploma_png_path is missing')
    if (!cert?.diploma_pdf_path) throw new Error('Certificate diploma_pdf_path is missing')

    console.log('4. Asserting storage state...')
    const hasPng = await storage.exists(cert.diploma_png_path)
    if (!hasPng) throw new Error('PNG file not found in storage')
    
    const hasPdf = await storage.exists(cert.diploma_pdf_path)
    if (!hasPdf) throw new Error('PDF file not found in storage')

    const hasZip = await storage.exists(gen.zip_path)
    if (!hasZip) throw new Error('ZIP file not found in storage')

    console.log('  ✅  Engine successfully generated PNG, PDF, and ZIP!')
    
  } catch (err: any) {
    console.error(`  ❌  Test failed: ${err.message}`)
    throw err
  } finally {
    console.log('5. Cleaning up...')
    await cleanupDb()
    await cleanupStorage()
  }
}

run()
  .then(() => {
    console.log('\\n── Result: Passed ───────────────────────────────────\\n')
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
