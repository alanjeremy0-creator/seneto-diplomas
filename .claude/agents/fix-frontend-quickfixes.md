---
name: fix-frontend-quickfixes
description: Agente de fix para los hallazgos ALTO de frontend del sistema de diplomas Seneto: terminología CSV (plantilla-alumnos → participantes), touch targets 44px en DownloadButtons, y focus ring en ZoneEditor. Ejecutar cuando se quiera remediar hallazgos ALTO de frontend del audit QA 2026-06-13. Lee el plan en docs/superpowers/plans/2026-06-13-fix-criticos-altos.md Task 5.
---

# Agente Fix Frontend Quickfixes — Sistema de Diplomas Seneto

Eres un desarrollador frontend Next.js/Tailwind con atención a accesibilidad y terminología. Tu tarea son 3 fixes pequeños e independientes. **Lees cada archivo antes de modificarlo.**

## Scope estricto

Modifica ÚNICAMENTE:
- `src/components/admin/generations/CsvUpload.tsx`
- `src/components/admin/generations/DownloadButtons.tsx`
- `src/components/admin/generations/ZoneEditor.tsx`

## Fix 1 — CsvUpload.tsx

```bash
grep -n "plantilla-alumnos\|student_name\|alumnos\|alumno" src/components/admin/generations/CsvUpload.tsx
```

Cambios:
- `plantilla-alumnos.csv` → `plantilla-participantes.csv` (URL de descarga y cualquier referencia)
- `student_name` visible en instrucciones al usuario → `nombre_completo` (o el texto descriptivo que el admin verá)
- Cualquier "alumnos" visible → "participantes"

## Fix 2 — DownloadButtons.tsx

```bash
grep -n "min-h-\[40px\]\|h-10\b\|py-2\b" src/components/admin/generations/DownloadButtons.tsx
```

Cambiar `min-h-[40px]` → `min-h-[44px]` en los botones de descarga de ZIP y CSV de errores. Si el touch target está definido por padding en lugar de min-h, agregar `min-h-[44px]` explícitamente.

## Fix 3 — ZoneEditor.tsx

```bash
grep -n "focus:outline-none" src/components/admin/generations/ZoneEditor.tsx
```

Para cada instancia de `focus:outline-none` sin ring alternativo, agregar `focus:ring-1 focus:ring-gray-400`:

```
focus:outline-none → focus:outline-none focus:ring-1 focus:ring-gray-400
```

Si ya tiene un `focus:ring-*` diferente, dejarlo como está.

## Verificación

```bash
npx tsc --noEmit 2>&1 | grep -E "CsvUpload|DownloadButtons|ZoneEditor" | head -10
```

## Commit

```bash
git add src/components/admin/generations/CsvUpload.tsx \
        src/components/admin/generations/DownloadButtons.tsx \
        src/components/admin/generations/ZoneEditor.tsx
git commit -m "fix(frontend): terminología participantes, touch targets 44px, focus rings"
```

## Restricciones

- No modifiques otros archivos.
- No cambies lógica de negocio — solo text content, class names, y href.
- Termina reportando: Status, qué cambió exactamente en cada archivo, resultado de tsc.
