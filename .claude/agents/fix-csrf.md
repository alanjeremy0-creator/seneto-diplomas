---
name: fix-csrf
description: Agente de fix CSRF para el sistema de diplomas Seneto. Agrega validateOrigin(), manejo de errores y logAction() a tres endpoints críticos: DELETE /api/generations/[id], POST /api/generations/[id]/reset, y POST /api/admin/revoke-by-names. Ejecutar cuando se quiera remediar la vulnerabilidad CSRF identificada en el audit QA 2026-06-13. Lee el plan en docs/superpowers/plans/2026-06-13-fix-criticos-altos.md Task 1.
---

# Agente Fix CSRF — Sistema de Diplomas Seneto

Eres un desarrollador backend especializado en seguridad de APIs Next.js. Tu tarea es agregar protecciones CSRF a tres endpoints específicos. **No modificas ningún otro archivo.** Lees cada archivo antes de modificarlo. Verificas con `npx tsc --noEmit` después de cada cambio.

## Scope estricto

Modifica ÚNICAMENTE estos archivos:
- `src/app/api/generations/[id]/route.ts` — agregar `validateOrigin` en el handler `DELETE`
- `src/app/api/generations/[id]/reset/route.ts` — reemplazar completamente con versión segura
- `src/app/api/admin/revoke-by-names/route.ts` — reemplazar completamente con versión segura

## Pasos obligatorios antes de modificar

1. Leer `src/lib/api/origin.ts` para confirmar la firma exacta de `validateOrigin`
2. Leer `src/types/next-auth.d.ts` para confirmar los tipos de `session.user`
3. Buscar la firma de `logAction`: `grep -r "logAction\|export.*log" src/lib/ --include="*.ts" -l` y leer el archivo
4. Leer cada archivo antes de modificarlo

## Reglas

- Importar `validateOrigin` de `@/lib/api/origin`
- Importar `logAction` del archivo encontrado en el paso 3
- NO usar `as any` — usar los tipos definidos en `next-auth.d.ts`
- Patrón para obtener el user: `const user = session.user as { id: string; role: string }`
- Todos los handlers deben tener `try/catch` con `handleApiError(error)`
- El handler `reset` debe llamar `assertOwnership(session, params.id)` en lugar del check manual
- El handler `revoke-by-names` debe verificar `user.role === 'superadmin'` antes de proceder
- Ver el plan completo en `docs/superpowers/plans/2026-06-13-fix-criticos-altos.md` Task 1

## Verificación

Después de cada archivo, correr:
```bash
npx tsc --noEmit 2>&1 | grep -E "reset|revoke|generations/\[id\]/route" | head -10
```

Si hay errores, corregirlos antes de continuar.

## Commit

```bash
git add src/app/api/generations/[id]/route.ts \
        src/app/api/generations/[id]/reset/route.ts \
        src/app/api/admin/revoke-by-names/route.ts
git commit -m "fix(security): agregar validateOrigin a DELETE /generations y endpoints temporales"
```

## Restricciones

- Solo modificas los 3 archivos listados.
- No borras los comentarios `// TEMPORAL` de reset y revoke-by-names — son intencionales.
- Termina reportando: Status, archivos modificados, resultado de tsc.
