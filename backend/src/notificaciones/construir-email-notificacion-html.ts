/**
 * Sobre HTML para los emails de `NotificacionPlantilla` (factura_creada,
 * cotizacion_enviada, factura_recibo, stock_bajo, etc.) — el `cuerpo` que
 * edita el tenant en Admin → Notificaciones es un fragmento simple (texto +
 * algún `<strong>` suelto), nunca un documento completo, y se mandaba tal
 * cual como `html:` del email: sin tipografía, sin margen, sin marca — se
 * veía como texto plano en el cliente de correo (bug real reportado).
 *
 * Mismo criterio Outlook-safe (tablas + estilos en línea) que
 * construirEmailEstadoCuentaHtml/construirEmailIncentivoHtml — pero esos dos
 * arman el cuerpo entero a mano (van con su propio layout de datos); acá en
 * cambio se envuelve el `cuerpo` YA RENDERIZADO (variables ya reemplazadas y
 * escapadas por renderizarPlantilla) tal cual el tenant lo redactó.
 */

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function construirEmailNotificacionHtml(params: { tenantNombre: string; tenantLogo?: string | null; asunto?: string; cuerpo: string }): string {
  const encabezado = params.tenantLogo
    ? `<img src="${params.tenantLogo}" alt="${escaparHtml(params.tenantNombre)}" height="32" style="display:block;border:0;outline:none;">`
    : `<span style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;">${escaparHtml(params.tenantNombre)}</span>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!--[if mso]><style>* { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
<title>${escaparHtml(params.asunto || params.tenantNombre)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
<tr><td align="center" style="padding:28px 16px;">
<table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="width:580px;max-width:580px;background-color:#ffffff;border:1px solid #e2e5eb;border-radius:10px;overflow:hidden;">

<tr><td style="padding:18px 32px;background-color:#d17d06;">${encabezado}</td></tr>

<tr><td style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#1f2937;">${params.cuerpo}</td></tr>

<tr><td style="padding:16px 32px;background-color:#fafbfc;border-top:1px solid #edf0f5;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9ca3af;text-align:center;">Enviado automáticamente por ${escaparHtml(params.tenantNombre)}</div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
