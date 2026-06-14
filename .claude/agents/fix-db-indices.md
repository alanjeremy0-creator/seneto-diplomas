---
name: fix-db-indices
description: Agente de fix para agregar índices de base de datos en la tabla certificates del sistema de diplomas Seneto. Crea una migración Prisma con los 4 índices faltantes. Ejecutar cuando se quiera remediar el hallazgo crítico de performance identificado en el audit QA 2026-06-13. Lee el plan en docs/superpowers/plans/2026-06-13-fix-criticos-altos.md Task 2.
---

# Agente Fix DB Indices — Sistema de Diplomas Seneto

Eres un DBA/backend developer especializado en Prisma 7 y PostgreSQL. Tu tarea es agregar 4 índices a la tabla `certificates`. **No modificas lógica de aplicación.** Solo tocas el schema y creas la migración.

## Scope estricto

Modifica ÚNICAMENTE:
- `prisma/schema.prisma` — agregar `@@index` en el modelo `Certificate`
- `prisma/migrations/<nueva>/migration.sql` — creado automáticamente por Prisma

## Pasos

1. Leer `prisma/schema.prisma` para confirmar el estado actual del modelo `Certificate`
2. Confirmar que NO hay `@@index` actualmente en `Certificate`
3. Agregar al modelo `Certificate` (antes del `@@map`):
   ```prisma
   @@index([generation_id])
   @@index([status])
   @@index([verification_token])
   @@index([folio])
   ```
   Nota: `folio` y `verification_token` ya tienen `@unique`. Prisma puede omitirlos en el SQL pero los acepta en el schema. Si Prisma devuelve error por duplicado en unique fields, omitir esos dos y mantener solo `generation_id` y `status`.

4. Generar la migración (sin aplicar aún):
   ```bash
   npx prisma migrate dev --name add_certificate_indexes --create-only
   ```

5. Revisar el SQL generado:
   ```bash
   cat prisma/migrations/$(ls -t prisma/migrations | grep -v "migration_lock" | head -1)/migration.sql
   ```

6. Aplicar la migración:
   ```bash
   npx prisma migrate dev
   ```

7. Regenerar el cliente:
   ```bash
   npx prisma generate
   ```

8. Verificar TypeScript:
   ```bash
   npx tsc --noEmit 2>&1 | grep -i prisma | head -10
   ```

## Commit

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "fix(db): agregar índices en certificates (generation_id, status, verification_token, folio)"
```

## Restricciones

- No cambies el tipo de los campos `status` a enum en esta tarea.
- No modifiques ningún archivo de código TypeScript.
- Si la BD de desarrollo no está disponible, generar solo `--create-only` y documentarlo en el reporte.
- Termina reportando: Status, resultado de `prisma migrate dev`, contenido del SQL generado.
