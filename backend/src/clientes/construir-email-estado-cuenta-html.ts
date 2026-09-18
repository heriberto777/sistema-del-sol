/**
 * Email de estado de cuenta — mismo criterio de compatibilidad que
 * construirEmailIncentivoHtml (tablas + estilos en línea, Outlook-safe).
 * El detalle factura por factura va en el PDF adjunto, no acá — este
 * cuerpo es solo el resumen (evita un email larguísimo si el cliente
 * tiene muchos movimientos en el período).
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

export function construirEmailEstadoCuentaHtml(params: {
  clienteNombre: string;
  periodoTexto: string;
  totalFacturado: number;
  totalPagado: number;
  saldoPendiente: number;
  cantidadFacturas: number;
}): string {
  const colorSaldo = params.saldoPendiente > 0.005 ? '#c23b3b' : '#1f8a56';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!--[if mso]><style>* { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
<title>Estado de cuenta</title>
</head>
<body style="margin:0;padding:0;background-color:#eef0f4;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Saldo pendiente: RD$ ${formatoMonto(params.saldoPendiente)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef0f4;">
<tr><td align="center" style="padding:28px 16px;">
<table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="width:580px;max-width:580px;background-color:#ffffff;border:1px solid #e2e5eb;border-radius:10px;">

<tr><td style="padding:22px 32px 16px 32px;border-bottom:1px solid #edf0f5;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#4f46e5;font-weight:bold;">Estado de cuenta</div>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;margin-top:2px;">${escaparHtml(params.periodoTexto)}</div>
</td></tr>

<tr><td style="padding:22px 32px;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;margin-bottom:16px;">Hola <b>${escaparHtml(params.clienteNombre)}</b>, este es el resumen de tu cuenta con nosotros:</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;">
<tr><td style="padding:6px 0;color:#6b7280;">Movimientos en el período</td><td align="right" style="padding:6px 0;color:#111827;">${params.cantidadFacturas}</td></tr>
<tr><td style="padding:6px 0;color:#6b7280;">Total facturado</td><td align="right" style="padding:6px 0;color:#111827;">RD$ ${formatoMonto(params.totalFacturado)}</td></tr>
<tr><td style="padding:6px 0;color:#6b7280;">Total pagado</td><td align="right" style="padding:6px 0;color:#111827;">RD$ ${formatoMonto(params.totalPagado)}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;"><tr>
<td style="background-color:#f8f9fb;border-radius:8px;padding:14px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;">Saldo pendiente</td>
<td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;color:${colorSaldo};">RD$ ${formatoMonto(params.saldoPendiente)}</td>
</tr></table>
</td>
</tr></table>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;margin-top:16px;">El detalle factura por factura está en el PDF adjunto.</div>
</td></tr>

<tr><td style="padding:16px 32px;background-color:#fafbfc;border-top:1px solid #edf0f5;border-radius:0 0 10px 10px;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9ca3af;text-align:center;">Enviado automáticamente desde El Sistema del Sol</div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
