/** Compartido por documento-pdf.ts y documento-ticket.ts para que ambos formateen RD$ igual. */
export const formatearMontoDop = (monto: number) =>
  `RD$ ${monto.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
