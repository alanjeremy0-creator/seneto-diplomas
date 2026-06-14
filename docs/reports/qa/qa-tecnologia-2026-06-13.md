# Reporte QA Tecnología — 2026-06-13

## Resumen
- Crítico: 0
- Alto: 4
- Medio: 4
- Bajo: 3
- OK: 12

---

## Hallazgos

### [ALTO] — `typescript.ignoreBuildErrors: true` activo en producción

**Archivo:** `next.config.mjs:9-11`
**Descripción:** La opción `ignoreBuildErrors: true` hace que `next build` nunca falle por errores de TypeScript, sin importar su gravedad. Errores de tipo que romperían la aplicación en runtime pasan silenciosamente al bundle de producción. En combinación con `skipLibCheck: true` en `tsconfig.json`, la cobertura de tipo efectiva es mínima durante el build.
**Recomendación:** Eliminar `ignoreBuildErrors: true` y correr `tsc --noEmit` localmente para identificar y resolver los errores actuales. Si hay errores de tipos en librerías de terceros (`@prisma/client`, `canvas`), suprimirlos con `// @ts-ignore` en el punto de uso, no silenciando el compilador globalmente.

---

### [ALTO] — `eslint.ignoreDuringBuilds: true` activo en producción

**Archivo:** `next.config.mjs:6-8`
**Descripción:** El build de producción no ejecuta ESLint. Errores de linting (variables no declaradas, hooks mal usados, imports faltantes) no bloquean el deploy. Esto nulifica la protección que ofrecen reglas como `react-hooks/rules-of-hooks` y `@next/next/no-html-link-for-pages`.
**Recomendación:** Eliminar `ignoreDuringBuilds: true`. Si hay errores de lint pendientes, resolverlos o convertirlos en `warn` en `.eslintrc.json` para no bloquear el build mientras se corrigen incrementalmente.

---

### [ALTO] — Falta header `Content-Security-Policy`

**Archivo:** `next.config.mjs:12-28`
**Descripción:** Los headers de seguridad incluyen `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy` y `Permissions-Policy`, pero no hay `Content-Security-Policy`. Sin CSP, el navegador no tiene restricciones sobre qué scripts, estilos e iframes puede cargar la página, lo que expone la aplicación a ataques XSS y data exfiltration. La aplicación maneja documentos con valor legal (diplomas con QR de verificación), lo cual eleva el impacto potencial.
**Recomendación:** Agregar un header CSP con política restrictiva. Mínimo viable para Next.js: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:`. Después de estabilizar, eliminar `unsafe-inline` usando nonces de Next.js.

---

### [ALTO] — Falta header `Strict-Transport-Security` (HSTS)

**Archivo:** `next.config.mjs:12-28`
**Descripción:** No hay header `Strict-Transport-Security`. Sin HSTS, los navegadores que accedan vía HTTP no son redirigidos automáticamente a HTTPS, y un atacante en la red puede realizar un downgrade attack. El sistema maneja autenticación (`next-auth`) y documentos legales, lo que hace crítica la conexión siempre sobre TLS.
**Recomendación:** Agregar `{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }` a los headers en `next.config.mjs`. Si el proxy inverso (nginx/Caddy) ya lo inyecta, documentarlo explícitamente en `ARCHITECTURE_HANDOFF.md` para que no se confunda con una omisión.

---

### [MEDIO] — `next@14.2.35` en rama maintenance-only

**Archivo:** `package.json:21`
**Descripción:** Next.js 14.x está en modo maintenance-only desde la disponibilidad general de Next.js 15. La rama activa de desarrollo y parches de seguridad es 15.x. No hay CVEs activos conocidos para `14.2.35` al 2026-06-13, pero los futuros parches de seguridad serán backporteados con menor prioridad o no serán backporteados. `eslint-config-next@14.2.35` también deberá actualizarse en conjunto.
**Recomendación:** Planificar migración a Next.js 15.x en el próximo sprint de mantenimiento. El cambio principal es el comportamiento de caché (ahora opt-in en lugar de opt-out). Documentar en el backlog como deuda técnica de prioridad media.

---

### [MEDIO] — `next-auth@^4.24.14` en rama EOL

**Archivo:** `package.json:22`
**Descripción:** NextAuth.js v4 entró en estado EOL cuando Auth.js (v5) fue declarado estable. La rama v4 no recibe nuevos parches de seguridad. No hay CVEs activos conocidos para `4.24.14` al 2026-06-13, pero la ventana de exposición crece con el tiempo. La migración a Auth.js v5 involucra cambios de API (`getServerSession` → `auth()`, `SessionProvider` renombrado, callbacks renombrados).
**Recomendación:** Evaluar migración a Auth.js v5 en los próximos 2 sprints. Documentar en el backlog. Mientras tanto, monitorear el advisory de seguridad de `next-auth` en GitHub Advisories.

---

### [MEDIO] — No hay workflow de CI que ejecute `tsc --noEmit` ni `npm audit`

**Archivo:** `.github/workflows/` (solo existe `supabase-keep-alive.yml`)
**Descripción:** El único workflow de CI es el keep-alive de Supabase. No hay pipeline que ejecute verificación de tipos, lint, ni auditoría de dependencias en cada push o pull request. Dado que `ignoreBuildErrors` y `ignoreDuringBuilds` están activos, el único gatekeeper de calidad es el desarrollador localmente.
**Recomendación:** Agregar un workflow `ci.yml` que en cada push a `main` ejecute: (1) `tsc --noEmit`, (2) `next lint`, (3) `npm audit --audit-level=high`. Este workflow debe configurarse para fallar el PR si alguno de los tres falla.

---

### [MEDIO] — `canvas@^3.2.3` instalado pero no importado en el código fuente

**Archivo:** `package.json:19`, `next.config.mjs:4`
**Descripción:** `canvas` está declarado como dependencia de producción y listado explícitamente en `serverComponentsExternalPackages`. Sin embargo, no hay ningún `import ... from 'canvas'` ni `require('canvas')` en `src/`. El paquete `canvas` requiere Cairo y otras bibliotecas nativas del sistema para compilar/ejecutar, lo cual es una dependencia de sistema no trivial en servidores Linux. Instalar Cairo innecesariamente en producción aumenta la superficie de mantenimiento y el tiempo de setup del servidor.
**Recomendación:** Verificar si `canvas` era un artefacto de exploración temprana. Si no se usa, eliminarlo de `dependencies`, `devDependencies` (`@types/canvas` si existe), y de `serverComponentsExternalPackages` en `next.config.mjs`. Si se planea usar en el futuro, moverlo a una rama feature y documentar la dependencia de sistema (`libcairo2-dev`, `libpango1.0-dev`).

---

### [BAJO] — `adm-zip` solo se usa en scripts de smoke test, no en producción

**Archivo:** `package.json:16`, `scripts/smoke-zipper.mjs`
**Descripción:** `adm-zip` está declarado en `dependencies` (producción), pero su único uso encontrado es en `scripts/smoke-zipper.mjs` — un script de testing manual. El código de producción usa `archiver` (para crear ZIPs) y `yauzl` (para leer ZIPs). Tener `adm-zip` en `dependencies` lo incluye en el bundle de producción innecesariamente.
**Recomendación:** Mover `adm-zip` y `@types/adm-zip` a `devDependencies`, ya que solo se usa en scripts de prueba. Esto reduce el peso del bundle de producción y clarifica qué paquetes son necesarios en el servidor.

---

### [BAJO] — Falta `.nvmrc` o especificación de `engines` en `package.json`

**Archivos:** raíz del proyecto, `package.json`
**Descripción:** `sharp@0.34.x` requiere Node.js ≥18.17.0. El proyecto no tiene `.nvmrc`, `.node-version`, ni campo `"engines"` en `package.json`. Un desarrollador nuevo o un CI runner con Node.js 18.16.x o anterior podría encontrar errores de instalación de `sharp` sin mensaje de error claro.
**Recomendación:** Agregar un archivo `.nvmrc` con el contenido `20` (LTS activo) y/o el campo `"engines": { "node": ">=20.0.0" }` en `package.json`. Esto documenta el requisito mínimo y permite que `npm` lo valide con `--engine-strict`.

---

### [BAJO] — `NEXTAUTH_SECRET` en `.env.example` es un placeholder descriptivo pero no aleatorio

**Archivo:** `.env.example:2`
**Descripción:** El valor `"cambia-esto-por-un-secreto-de-minimo-32-caracteres"` es un placeholder de texto plano, no un secreto real. Este punto es informativo — el placeholder es adecuado para documentación. Sin embargo, la longitud del placeholder (47 caracteres) es mayor a 32, lo que podría llevar a un desarrollador apresurado a usarlo tal cual.
**Recomendación:** Cambiar el placeholder por algo más inequívoco como `"REEMPLAZAR_CON_OUTPUT_DE_openssl rand -base64 32"` para que sea imposible confundirlo con un valor real.

---

### [OK] — `postinstall: prisma generate` presente

**Archivo:** `package.json:10`
**Descripción:** El script `postinstall` ejecuta `prisma generate` automáticamente después de `npm install`. Esto garantiza que el cliente de Prisma siempre esté generado en cualquier entorno, incluyendo CI y el servidor de producción tras el deploy.

---

### [OK] — Workflow de Supabase keep-alive configurado correctamente

**Archivo:** `.github/workflows/supabase-keep-alive.yml`
**Descripción:** El workflow se ejecuta cada 5 días (antes del límite de 7 días de Supabase free tier), detecta si el proyecto está INACTIVE, lo restaura vía API REST, y hace un ping adicional vía PostgREST. La lógica es correcta y usa secrets de GitHub (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_ANON_KEY`) en lugar de hardcodear credenciales.

---

### [OK] — Headers de seguridad básicos configurados

**Archivo:** `next.config.mjs:13-26`
**Descripción:** Presentes y con valores correctos: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. El scope `/(.*)'` cubre todas las rutas.

---

### [OK] — No hay variables `NEXT_PUBLIC_` con secretos

**Archivo:** `.env.example`, `src/`
**Descripción:** No se encontró ninguna variable con prefijo `NEXT_PUBLIC_` en el archivo `.env.example` ni en el código fuente. Las variables de entorno sensibles (`DATABASE_URL`, `NEXTAUTH_SECRET`) permanecen del lado del servidor.

---

### [OK] — `.env.example` documenta todas las variables requeridas

**Archivo:** `.env.example`
**Descripción:** El archivo documenta `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `BASE_URL`, `STORAGE_PATH` y `PUBLIC_VERIFY_BASE_URL`. Incluye comentarios explicativos sobre el propósito de `PUBLIC_VERIFY_BASE_URL` y los valores por entorno (local, QA, producción).

---

### [OK] — `pdf-lib` y `qrcode` son 100% JavaScript

**Archivo:** `package.json`
**Descripción:** Ambas dependencias son pure-JS sin bindings nativos. No requieren bibliotecas del sistema en el servidor Linux de producción.

---

### [OK] — `sharp` es compatible con Linux x64 sin compilación

**Archivo:** `package.json:29`
**Descripción:** `sharp@0.34.x` descarga binarios precompilados para `linux-x64` a través de `@img/sharp-linux-x64`. No requiere instalar `libvips` manualmente en el servidor de producción, siempre que Node.js ≥18.17.0 esté instalado.

---

### [OK] — `yauzl` se usa activamente para lectura de ZIPs

**Archivo:** `src/app/api/generations/[id]/photos/route.ts`
**Descripción:** `yauzl` tiene un import activo en la ruta de API de fotos. No es redundante con `archiver` — `archiver` crea ZIPs, `yauzl` los lee. La separación de responsabilidades es correcta.

---

### [OK] — `archiver` se usa activamente para creación de ZIPs

**Archivo:** `src/lib/diploma/zipper.ts`
**Descripción:** `archiver` tiene un import activo en la biblioteca de zipper de diplomas. Su uso complementa a `yauzl` (lectura) y es la herramienta adecuada para creación de archivos ZIP en streaming.

---

### [OK] — `prisma.config.ts` externaliza la URL de conexión

**Archivo:** `prisma.config.ts`
**Descripción:** La URL de base de datos se carga desde `process.env["DATABASE_URL"]` a través de `dotenv/config`. El `schema.prisma` no hardcodea la URL, lo cual es correcto. El campo `datasource db` sin `url` directo es intencional en Prisma 7 cuando se usa `prisma.config.ts` como fuente de verdad.

---

### [OK] — TypeScript en modo `strict: true`

**Archivo:** `tsconfig.json:8`
**Descripción:** El compilador tiene `strict: true` activado, lo que habilita `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes` y otros. Esto maximiza la detección de errores cuando `ignoreBuildErrors` sea removido (ver hallazgo ALTO correspondiente).

---

## Resumen ejecutivo

El proyecto tiene una base técnica sólida: dependencias bien elegidas, separación correcta de responsabilidades entre `yauzl`/`archiver`, Prisma 7 con configuración externa, y headers de seguridad básicos. Los cuatro hallazgos ALTO son configuraciones activas que reducen la seguridad del sistema en producción y deben resolverse antes del siguiente deploy a QA:

1. Remover `ignoreBuildErrors` y `ignoreDuringBuilds` (riesgo de regresiones silenciosas)
2. Agregar CSP y HSTS (superficie de ataque XSS y downgrade HTTP)

Los hallazgos MEDIO de mayor impacto son la ausencia de pipeline CI y el paquete `canvas` no utilizado que trae una dependencia nativa de sistema innecesaria.
