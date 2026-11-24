# Inbox — tirá acá cualquier dato en crudo

Esta es la **carpeta de ingesta** de la base de conocimiento. Tirá
cualquier cosa acá y un agente la procesa en la wiki en el próximo
barrido.

> Aquí cae cualquier dato en crudo. No hay formato rígido. El sistema se
> adapta a tu caos, no al revés.

## Qué podés tirar

Cualquier cosa. En serio:

- Facturas, extractos bancarios, modelos de impuestos — `*.pdf`
- Fotos de recibos, capturas, pizarras — `*.png`, `*.jpg`, `*.heic`
- Exports de APIs, payloads — `*.json`
- Hojas de cálculo, CSVs — `*.csv`, `*.xlsx`
- Notas sueltas, markdown, txt — `*.md`, `*.txt`
- Páginas guardadas, documentos — `*.html`, `*.docx`, `*.eml`

Si el agente puede leerlo, se ingiere. Si no puede, el original se
preserva y se registra un gap para vos — nada se descarta en silencio.

## Cómo funciona

1. **Tirás** archivos acá (o carpetas enteras).
2. **El agente sale a pasear** — corré un barrido diciendo *"procesa el
   inbox"* (o corre solo, programado). Para cada archivo:
   - detecta el formato y extrae el contenido,
   - lo clasifica en un tema (`finanzas/`, `operations/`, …) por de qué
     trata, no por su formato,
   - lo relaciona con lo que ya está en la wiki (cross-links),
   - lo compila en un artículo de la wiki.
3. **Los archivos procesados se mueven** a `_processed/YYYY-MM-DD/` como
   rastro de auditoría — el original byte a byte también queda en
   `../raw/<tema>/_originals/`.
4. **Cada archivo nuevo alimenta y mejora el sistema** — el ciclo de
   mantenimiento y mejora corre automático después del barrido.

## Carpetas

- `_processed/` — archivos ya ingeridos, archivados por fecha de
  barrido. Seguro de podar una vez que confiás en la wiki.

## Programar el paseo (opcional)

```bash
# Barrido nocturno del inbox a las 02:00
schedule create wiki-inbox --cron "0 2 * * *" --command "procesa el inbox"
```

No hace falta esperar al horario — decí *"procesa el inbox"* cuando
quieras.
