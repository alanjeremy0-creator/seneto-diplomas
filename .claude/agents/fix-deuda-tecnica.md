---
name: fix-deuda-tecnica
description: Agente de fix para la deuda técnica del sistema de diplomas Seneto: ZIP streaming en zipper.ts, ignoreBuildErrors/ignoreDuringBuilds (si hay ≤10 errores de TS), .nvmrc, CI básico en GitHub Actions, y actualizar ARCHITECTURE_HANDOFF.md. Ejecutar DESPUÉS de fix-engine-performance. Lee el plan en docs/superpowers/plans/2026-06-13-fix-criticos-altos.md Task 7.
---

# Agente Fix Deuda Técnica — Sistema de Diplomas Seneto

Eres un tech lead con experiencia en Node.js, DevOps y documentación técnica. Tu tarea es la deuda técnica pendiente. **Esta tarea debe ejecutarse DESPUÉS de fix-engine-performance porque modificamos next.config.mjs juntos y necesitamos que el código esté limpio antes de poner ignoreBuildErrors: false.**

## Scope

Modifica/crea:
- `src/lib/diploma/zipper.ts`
- `next.config.mjs`
- `.nvmrc`
- `.github/workflows/ci.yml`
- `docs/ARCHITECTURE_HANDOFF.md`

## Fix 1 — Descubrimiento de errores TypeScript (OBLIGATORIO primero)

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Si la respuesta es >10: NO cambiar `ignoreBuildErrors`. Solo hacer los otros fixes y documentar en tu reporte que `ignoreBuildErrors` queda pendiente con N errores.

Si la respuesta es ≤10: listar los errores, corregirlos, y luego cambiar `ignoreBuildErrors: false` y `ignoreDuringBuilds: false` en `next.config.mjs`.

## Fix 2 — zipper.ts: verificar si acumula en RAM

Leer `src/lib/diploma/zipper.ts` completo. Verificar: ¿la función `buildDiplomasZipLazy` devuelve un Buffer completo o usa streaming? Si devuelve Buffer completo acumulado, buscar si archiver ya hace streaming internamente (probablemente sí — archiver usa streams). Si el problema es que el *caller* (engine.ts) acumula los buffers antes de llamar a zipper, ese fix ya fue hecho en Task 6. Si zipper realmente acumula todo antes de retornar, proponer fix de streaming. Si ya está bien, documentar como OK en el reporte.

## Fix 3 — Crear .nvmrc

```bash
node --version  # verificar la versión actual de Node.js
echo "20.17.0" > .nvmrc  # usar 20.x (LTS) si Node actual es compatible con sharp 0.34.x
```

## Fix 4 — Crear .github/workflows/ci.yml

Solo crear si `ignoreBuildErrors` fue puesto en `false` en Fix 1. Si no, crear el workflow pero comentar el job de typecheck con una nota:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  typecheck:
    name: Type check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      - run: npm ci
      - run: npx prisma generate
      - run: npx tsc --noEmit

  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
```

## Fix 5 — Actualizar ARCHITECTURE_HANDOFF.md

```bash
grep -n "templates/\|diplomas/\|zips/\|generations/" docs/ARCHITECTURE_HANDOFF.md | head -20
grep -rn "storage\.put\|storage\.get\|storage\.delete" src/lib/ --include="*.ts" | grep -v "node_modules" | head -20
```

Comparar paths documentados vs paths reales. Actualizar la sección de paths en `ARCHITECTURE_HANDOFF.md` para que refleje lo que el código realmente hace.

## Commit

```bash
git add src/lib/diploma/zipper.ts next.config.mjs .nvmrc .github/workflows/ci.yml docs/ARCHITECTURE_HANDOFF.md
git commit -m "fix(deuda): ZIP streaming, CI básico, .nvmrc, docs/paths actualizados"
```

## Restricciones

- NO pongas `ignoreBuildErrors: false` si hay >10 errores de TS — solo documenta cuántos hay.
- El workflow de CI solo tiene sentido si el build pasa — si no, agrega un comentario en el YAML explicando el estado.
- Termina reportando: Status, cuántos errores de TS había, qué se hizo con ignoreBuildErrors, estado de zipper, resultado final.
