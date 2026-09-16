import type { ResumenIncentivo } from './categorias-incentivo.service';

/**
 * Plantilla "Minimal ejecutivo" elegida por el usuario entre las 4
 * opciones del artifact de diseño — reemplaza el `<pre style="font-family:
 * monospace">` que se mandaba antes por EMAIL (el mismo texto de WhatsApp
 * pegado tal cual). Tablas + estilos en línea a propósito: Outlook de
 * escritorio renderiza con el motor de Word, que ignora flexbox/grid y
 * gran parte de un `<style>` en el `<head>` — ver el artifact para el
 * resto de las notas de compatibilidad.
 */

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatoMonto(n: number): string {
  return n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Mismo umbral que ya usa la tarjeta de cada renglón en MisTareas.tsx (frontend) — no reinventar el criterio acá. */
function colorPorPorcentaje(porcentaje: number): string {
  if (porcentaje >= 98) return '#1f8a56';
  if (porcentaje >= 90) return '#b3790a';
  return '#c23b3b';
}

function enlaceIncentivos(): string {
  return `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/mis-tareas?vista=incentivos`;
}

const MAX_TAREAS_MOSTRADAS = 5;

function filaRenglon(nombre: string, porcentaje: number, montoGanado: number, peso: number): string {
  const color = colorPorPorcentaje(porcentaje);
  const ancho = Math.min(100, Math.max(0, porcentaje));
  const barra =
    ancho > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;"><tr>
           <td width="${ancho}%" style="background-color:${color};border-radius:3px 0 0 3px;height:6px;line-height:6px;font-size:1px;">&nbsp;</td>
           <td width="${100 - ancho}%" style="background-color:#f1f2f5;border-radius:0 3px 3px 0;height:6px;line-height:6px;font-size:1px;">&nbsp;</td>
         </tr></table>`
      : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;"><tr>
           <td style="background-color:#f1f2f5;border-radius:3px;height:6px;line-height:6px;font-size:1px;">&nbsp;</td>
         </tr></table>`;

  return `<tr><td style="padding:9px 0;border-bottom:1px solid #f1f2f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font-size:13.5px;color:#111827;font-weight:600;font-family:Arial,Helvetica,sans-serif;">${escaparHtml(nombre)}</td>
      <td align="right" style="font-size:13px;color:${color};font-weight:700;font-family:Arial,Helvetica,sans-serif;">${porcentaje.toFixed(2)}%</td>
    </tr></table>
    ${barra}
    <div style="font-size:11.5px;color:#9ca3af;margin-top:4px;font-family:Arial,Helvetica,sans-serif;">$${formatoMonto(montoGanado)} de $${formatoMonto(peso)}</div>
  </td></tr>`;
}

export function construirEmailIncentivoHtml(resumen: ResumenIncentivo, opciones: { comentario?: string; analisisIa?: string } = {}): string {
  const { comentario, analisisIa } = opciones;
  const colorGeneral = colorPorPorcentaje(resumen.porcentajeGeneral);

  const tareasMostradas = resumen.tareasPendientes.slice(0, MAX_TAREAS_MOSTRADAS);
  const tareasRestantes = resumen.tareasPendientes.length - tareasMostradas.length;

  const filasTareas =
    tareasMostradas.length > 0
      ? tareasMostradas
          .map(
            (t) =>
              `<tr><td style="padding:4px 0;font-size:13px;color:#374151;font-family:Arial,Helvetica,sans-serif;">• ${escaparHtml(t.titulo)}${
                t.categoriaNombre ? ` <span style="color:#9ca3af;">(${escaparHtml(t.categoriaNombre)})</span>` : ''
              }</td></tr>`,
          )
          .join('')
      : `<tr><td style="padding:4px 0;font-size:13px;color:#9ca3af;font-family:Arial,Helvetica,sans-serif;font-style:italic;">Ninguna — todas las tareas del período están completadas. 🎉</td></tr>`;

  const enlaceMasTareas =
    tareasRestantes > 0
      ? `<div style="margin-top:8px;"><a href="${enlaceIncentivos()}" style="font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#4f46e5;text-decoration:none;font-weight:600;">Ver las ${tareasRestantes} tareas restantes en la app →</a></div>`
      : '';

  const bloqueComentario = comentario?.trim()
    ? `<tr><td style="padding:6px 32px 4px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="background-color:#f8f7ff;border-left:3px solid #4f46e5;border-radius:0 6px 6px 0;padding:12px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;font-style:italic;">
            ${escaparHtml(comentario.trim()).replace(/\n/g, '<br>')}
          </td>
        </tr></table>
      </td></tr>`
    : '';

  const bloqueAnalisisIa = analisisIa?.trim()
    ? `<tr><td style="padding:6px 32px 4px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="background-color:#f5f8ff;border:1px solid #dbe4ff;border-radius:8px;padding:14px 16px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:#4f46e5;font-weight:bold;margin-bottom:6px;">🤖 Análisis de IA</div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;line-height:1.55;">${escaparHtml(analisisIa.trim()).replace(/\n/g, '<br>')}</div>
          </td>
        </tr></table>
      </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<!--[if mso]>
<style>* { font-family: Arial, Helvetica, sans-serif !important; } table { border-collapse:collapse; }</style>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<title>Reporte de cumplimiento — Incentivo IT</title>
</head>
<body style="margin:0;padding:0;background-color:#eef0f4;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Cumplimiento de ${escaparHtml(resumen.periodo)}: ${resumen.porcentajeGeneral.toFixed(2)}% — $${formatoMonto(resumen.montoGanadoTotal)} de $${formatoMonto(resumen.pesoTotal)} en incentivo total.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef0f4;">
<tr><td align="center" style="padding:28px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #e2e5eb;border-radius:10px;">

<tr><td style="padding:22px 32px 16px 32px;border-bottom:1px solid #edf0f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#4f46e5;font-weight:bold;">Reporte de cumplimiento</td>
<td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;">${escaparHtml(resumen.periodo)}</td>
</tr></table>
</td></tr>

<tr><td style="padding:26px 32px 10px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="50%" style="font-family:Arial,Helvetica,sans-serif;">
<div style="font-size:12px;color:#6b7280;margin-bottom:4px;">Cumplimiento general</div>
<div style="font-size:34px;line-height:1.1;font-weight:800;color:${colorGeneral};">${resumen.porcentajeGeneral.toFixed(2)}%</div>
</td>
<td width="50%" align="right" style="font-family:Arial,Helvetica,sans-serif;">
<div style="font-size:12px;color:#6b7280;margin-bottom:4px;">Incentivo ganado</div>
<div style="font-size:22px;line-height:1.3;font-weight:800;color:#111827;">$${formatoMonto(resumen.montoGanadoTotal)} <span style="font-size:13px;font-weight:600;color:#9ca3af;">/ $${formatoMonto(resumen.pesoTotal)}</span></div>
</td>
</tr></table>
</td></tr>

<tr><td style="padding:14px 32px 4px 32px;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:#6b7280;font-weight:bold;margin-bottom:10px;">Renglones</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;">
${resumen.renglones.map((r) => filaRenglon(r.nombre, r.porcentaje, r.montoGanado, r.peso)).join('')}
</table>
</td></tr>

<tr><td style="padding:18px 32px 4px 32px;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:#6b7280;font-weight:bold;margin-bottom:8px;">Tareas pendientes${resumen.tareasPendientes.length > 0 ? ` (${tareasMostradas.length} de ${resumen.tareasPendientes.length})` : ''}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${filasTareas}</table>
${enlaceMasTareas}
</td></tr>

${bloqueComentario}
${bloqueAnalisisIa}

<tr><td style="padding:16px 32px;background-color:#fafbfc;border-top:1px solid #edf0f5;border-radius:0 0 10px 10px;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9ca3af;text-align:center;">Enviado automáticamente desde el Sistema de Gestión IT — Sistema del Sol</div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
