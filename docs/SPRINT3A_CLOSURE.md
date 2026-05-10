# Sprint 3A — Closure Document
# Sistema de Diplomas Seneto

_Orchestrator: Jeremy + Daedalus · 2026-05-10_
_Implementado por: Antigravity/Gemini · Auditado por: Claude Code (3 agentes independientes)_

---

## Estado

**CERRADO — PASS con deuda documentada**

---

## Commit final

```
2b18f92 fix: address Sprint 3A audit blockers
```

---

## Qué se implementó en Sprint 3A

| Ticket | Descripción | Archivo principal |
|---|---|---|
| S3A-001 | QR generation module | `src/lib/diploma/qr.ts` |
| S3A-002 | PNG composer | `src/lib/diploma/composer.ts` |
| S3A-003 | PDF builder | `src/lib/diploma/pdf.ts` |
| S3A-007 | ZIP builder | `src/lib/diploma/zipper.ts` |
| S3A-004 | Diploma generation engine | `src/lib/diploma/engine.ts` |
| S3A-005 | Endpoint async `/start` | `src/app/api/generations/[id]/start/route.ts` |
| S3A-006 | Frontend polling | `src/components/admin/generations/GenerationProgress.tsx` |

---

## Auditoría pre-cierre

Auditoría coordinada con 3 agentes independientes: Software Architect, Product Designer/UX, QA E2E.

**Veredicto consolidado:** NO PASS inicial → PASS con deuda documentada tras fixes puntuales.

### Fixes aplicados antes del cierre

| Fix | Severidad | Descripción |
|---|---|---|
| F-01 | BLOCKER | Reemplazar "alumnos/alumno" por "participantes/participante" en toda la UI visible (9 archivos) |
| F-02 | BLOCKER | Agregar guard de producción + header de documentación a `scripts/qa-e2e.ts` |
| F-03 | MAJOR | Reemplazar `verification_token: 'smoke-token-1234'` por `randomUUID()` en `smoke-engine.ts` |
| F-04 | MAJOR | Documentar decisión fire-and-forget y riesgo serverless en `ARCHITECTURE_HANDOFF.md` sección 12 |
| F-05 | MAJOR | CTA oficial "Generar diplomas" en `GenerationProgress.tsx` (antes: "Iniciar generación") |

---

## Gates de cierre

| Gate | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ Exit 0, sin errores |
| `grep -Rni "alumnos\|alumno" src/app src/components` | ✅ Solo `/plantilla-alumnos.csv` (URL de archivo, no texto visible) |
| `NODE_ENV=production npx tsx scripts/qa-e2e.ts` | ✅ Falla inmediatamente con guard — sin queries ejecutadas |
| `node scripts/smoke-qr.mjs` | ✅ Pasó antes del cierre (reportado por Antigravity/Gemini) |
| `node scripts/smoke-pdf.mjs` | ✅ Pasó antes del cierre |
| `node scripts/smoke-zipper.mjs` | ✅ Pasó antes del cierre |
| `npx tsx scripts/smoke-composer.ts` | ✅ Pasó antes del cierre |
| `npx tsx scripts/smoke-engine.ts` | ⏳ **Pendiente** — requiere DB/storage local seguro |

---

## Deuda documentada — Sprint 3B / hardening pre-producción

| ID | Descripción | Referencia |
|---|---|---|
| 3B-D01 | Test HTTP real de `POST /api/generations/[id]/start` con sesión NextAuth, `validateOrigin` y `assertOwnership` | `scripts/qa-e2e.ts` TODO |
| 3B-D02 | Test HTTP real de `GET /v/[token]` con request real | Gap QA-B03 |
| 3B-D03 | Job queue o worker dedicado si el entorno de deploy final es serverless | `ARCHITECTURE_HANDOFF.md` sección 12 |
| 3B-D04 | Recovery automático para generaciones atascadas en `processing` | `ARCHITECTURE_HANDOFF.md` sección 12 |
| 3B-D05 | Decodificar QR del artefacto final para confirmar que apunta a `verification_token` correcto | Gap QA-M03 |
| 3B-D06 | Backoff exponencial en polling de `GenerationProgress.tsx` | Gap QA-m04 |
| 3B-D07 | Convención de paths en storage (`diplomas/` vs `generations/.../diplomas/`) | Gap ARCH-m01 |
| 3B-D08 | Regex de `sanitizeError()` más robusta para paths de un segmento y chars especiales | Gap ARCH-M02 |
| 3B-D09 | Actualizar `CertificateStatus` en `ARCHITECTURE_HANDOFF.md` sección 5 para incluir `'pending'` | Gap ARCH-M01 |
| 3B-D10 | Renombrar archivo `plantilla-alumnos.csv` a `plantilla-participantes.csv` (terminología) | Nota F-01 |

---

## Principios confirmados vigentes post-Sprint 3A

- Ruta pública oficial: `/v/[token]` — usa `verification_token`, nunca folio
- QR apunta a `{PUBLIC_VERIFY_BASE_URL}/v/{verification_token}`
- Folio solo como texto visible, nunca como llave pública
- `Certificate.status` en falla individual: queda `pending` + `error_message` + crea `GenerationError`
- No existe estado `Certificate.status = 'error'`
- Transición `ready → processing` es atómica vía `updateMany` con condition
- Fire-and-forget aceptable **solo** en Node.js long-running (ver `ARCHITECTURE_HANDOFF.md` sección 12)
