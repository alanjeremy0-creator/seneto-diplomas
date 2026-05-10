/**
 * QA E2E auxiliar para Sprint 3A.
 *
 * Run with:
 *   npx tsx scripts/qa-e2e.ts
 *
 * Requires:
 *   - NODE_ENV !== "production"
 *   - DATABASE_URL apuntando a entorno local/QA seguro
 *   - storage local/QA seguro
 *
 * Nota:
 *   Este script valida engine + DB/storage de forma programática.
 *   Bypassea route.ts y NO valida NextAuth, validateOrigin ni ownership.
 *
 * TODO Sprint 3B:
 *   Reemplazar/complementar con test HTTP real para /api/generations/[id]/start
 *   que incluya sesión NextAuth, validateOrigin y assertOwnership.
 */
if (process.env.NODE_ENV === 'production') {
  throw new Error('[qa-e2e] Refusing to run in production environment')
}

process.env.PUBLIC_VERIFY_BASE_URL = 'http://localhost:3000'

import { prisma } from '../src/lib/db'
import { storage } from '../src/lib/storage/adapter'
import sharp from 'sharp'

const SUFFIX = Date.now().toString()
const USER_ID = `E2E-USER-${SUFFIX}`
const TEMPLATE_ID = `E2E-TEMPLATE-${SUFFIX}`
const GEN_ID = `E2E-GEN-${SUFFIX}`
const CERT_ID_1 = `E2E-CERT-1-${SUFFIX}`
const FOLIO_1 = `E2E-FOLIO-1-${SUFFIX}`
const CERT_ID_2 = `E2E-CERT-2-${SUFFIX}`
const FOLIO_2 = `E2E-FOLIO-2-${SUFFIX}`

async function setupE2E() {
  console.log('1. Setting up QA E2E test data...')
  
  await prisma.user.create({
    data: { id: USER_ID, email: `e2e-${SUFFIX}@test.com`, password_hash: 'hash', role: 'admin' }
  })

  await prisma.template.create({
    data: {
      id: TEMPLATE_ID,
      name: 'E2E Template',
      file_path: `templates/${TEMPLATE_ID}/template.png`,
      image_width_px: 2000,
      image_height_px: 1414,
      field_zones: {
        name: { x: 100, y: 100, width: 800, height: 100, fontColor: '#000000', fontSize: 60, align: 'center' },
        qr: { x: 1000, y: 1000, size: 300 }
      }
    }
  })

  await prisma.generation.create({
    data: {
      id: GEN_ID,
      name: 'E2E Generation',
      template_id: TEMPLATE_ID,
      status: 'ready', // important
      folio_prefix: 'E2E',
      folio_year: 2026,
      folio_counter: 1,
      total_count: 2,
      created_by: USER_ID
    }
  })

  await prisma.certificate.createMany({
    data: [
      {
        id: CERT_ID_1,
        folio: FOLIO_1,
        verification_token: `token-1-${SUFFIX}`,
        generation_id: GEN_ID,
        student_name: 'E2E Student 1',
        status: 'pending'
      },
      {
        id: CERT_ID_2,
        folio: FOLIO_2,
        verification_token: `token-2-${SUFFIX}`,
        generation_id: GEN_ID,
        student_name: 'E2E Student 2',
        status: 'pending'
      }
    ]
  })

  // Create a dummy template PNG
  const buf = await sharp({
    create: { width: 2000, height: 1414, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  }).png().toBuffer()
  await storage.put(`templates/${TEMPLATE_ID}/template.png`, buf)
}

async function runApiFlow() {
  console.log('2. Starting generation (bypassing route.ts and running engine directly for E2E since we do not have an active cookie session in this script)...')
  // We simulate the API /start route's atomic transition
  const transitioned = await prisma.generation.updateMany({
    where: { id: GEN_ID, status: 'ready' },
    data: { status: 'processing' },
  })
  if (transitioned.count === 0) throw new Error('Transition failed')

  const { runGenerationEngine } = await import('../src/lib/diploma/engine')
  
  // Fire and forget
  const enginePromise = runGenerationEngine(GEN_ID).catch(console.error)

  console.log('3. Polling /status (simulated by querying DB directly just as the /status API would)...')
  let completed = false
  while (!completed) {
    await new Promise(r => setTimeout(r, 1000))
    const gen = await prisma.generation.findUnique({ where: { id: GEN_ID } })
    console.log(`   [Poll] status: ${gen?.status}, processed: ${gen?.processed_count}, errors: ${gen?.error_count}`)
    if (gen?.status === 'completed' || gen?.status === 'failed') {
      completed = true
    }
  }

  // Wait for the promise to fully resolve just in case
  await enginePromise

  console.log('4. Asserting final state...')
  const gen = await prisma.generation.findUnique({ where: { id: GEN_ID } })
  if (gen?.status !== 'completed') throw new Error('Status not completed')
  if (gen?.processed_count !== 2) throw new Error('Processed count not 2')
  if (!gen?.zip_path) throw new Error('Zip path missing')

  const certs = await prisma.certificate.findMany({ where: { generation_id: GEN_ID } })
  for (const c of certs) {
    if (c.status !== 'active') throw new Error(`Cert ${c.id} not active`)
    if (!c.diploma_png_path || !c.diploma_pdf_path) throw new Error(`Cert ${c.id} paths missing`)
    
    // Check files exist
    const png = await storage.get(c.diploma_png_path)
    if (!png) throw new Error(`PNG missing for ${c.id}`)
    const pdf = await storage.get(c.diploma_pdf_path)
    if (!pdf) throw new Error(`PDF missing for ${c.id}`)
  }

  const zip = await storage.get(gen.zip_path)
  if (!zip) throw new Error('ZIP missing')

  console.log('  ✅ Flow successful. Zip, PDFs, and PNGs verified.')
}

async function cleanup() {
  console.log('5. Cleaning up E2E data...')
  try {
    await prisma.generationError.deleteMany({ where: { generation_id: GEN_ID } })
    await prisma.certificate.deleteMany({ where: { generation_id: GEN_ID } })
    await prisma.generation.delete({ where: { id: GEN_ID } })
    await prisma.template.delete({ where: { id: TEMPLATE_ID } })
    await prisma.user.delete({ where: { id: USER_ID } })

    await storage.delete(`templates/${TEMPLATE_ID}/template.png`).catch(()=>{})
    await storage.delete(`diplomas/${GEN_ID}/${FOLIO_1}.png`).catch(()=>{})
    await storage.delete(`diplomas/${GEN_ID}/${FOLIO_1}.pdf`).catch(()=>{})
    await storage.delete(`diplomas/${GEN_ID}/${FOLIO_2}.png`).catch(()=>{})
    await storage.delete(`diplomas/${GEN_ID}/${FOLIO_2}.pdf`).catch(()=>{})
    await storage.delete(`zips/${GEN_ID}/diplomas.zip`).catch(()=>{})
  } catch (e) {
    console.error('Cleanup failed', e)
  }
}

async function main() {
  try {
    await setupE2E()
    await runApiFlow()
  } finally {
    await cleanup()
  }
}

main().catch(e => {
  console.error('E2E Failed:', e)
  process.exit(1)
})
