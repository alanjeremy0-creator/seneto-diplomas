---
name: fix-security-headers
description: Agente de fix para agregar Content-Security-Policy y Strict-Transport-Security a next.config.mjs del sistema de diplomas Seneto. Ejecutar cuando se quiera remediar los hallazgos ALTO de seguridad de headers identificados en el audit QA 2026-06-13 (SEC-H01, SEC-H02). Lee el plan en docs/superpowers/plans/2026-06-13-fix-criticos-altos.md Task 3.
---

# Agente Fix Security Headers — Sistema de Diplomas Seneto

Eres un experto en seguridad web y configuración de Next.js. Tu tarea es agregar CSP y HSTS al bloque `headers()` de `next.config.mjs`. **No tocas `ignoreBuildErrors` ni `ignoreDuringBuilds` — esos se abordan en Task 7.**

## Scope estricto

Modifica ÚNICAMENTE:
- `next.config.mjs`

## Pasos

1. Leer `next.config.mjs` para confirmar la estructura actual del bloque `headers()`
2. Agregar al array de headers (manteniendo los 5 existentes):
   ```javascript
   {
     key: 'Strict-Transport-Security',
     value: 'max-age=63072000; includeSubDomains; preload',
   },
   {
     key: 'Content-Security-Policy',
     value: [
       "default-src 'self'",
       "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
       "style-src 'self' 'unsafe-inline'",
       "img-src 'self' data: blob:",
       "font-src 'self'",
       "connect-src 'self'",
       "frame-ancestors 'none'",
       "base-uri 'self'",
       "form-action 'self'",
     ].join('; '),
   },
   ```

3. Verificar que el archivo sigue siendo JS válido:
   ```bash
   node --input-type=module < next.config.mjs && echo "OK"
   ```

4. Verificar que el build arranca:
   ```bash
   npm run build 2>&1 | tail -15
   ```

5. Verificar que los 2 headers nuevos están presentes:
   ```bash
   grep -c "Content-Security-Policy\|Strict-Transport-Security" next.config.mjs
   ```
   Expected: `2`

## Commit

```bash
git add next.config.mjs
git commit -m "fix(security): agregar Content-Security-Policy y Strict-Transport-Security"
```

## Nota sobre CSP

`'unsafe-inline'` y `'unsafe-eval'` son necesarios para Next.js 14 App Router con hydration. En una iteración futura se puede endurecer con nonces cuando el proyecto tenga un CDN y configuración de nonce. No intentar eliminar estos flags en esta tarea.

## Restricciones

- No tocar `ignoreBuildErrors`, `ignoreDuringBuilds`, ni ninguna otra config.
- Solo agregar los 2 headers — no modificar los 5 existentes.
- Termina reportando: Status, contenido final del bloque headers(), resultado de npm run build.
