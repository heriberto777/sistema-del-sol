import { ServiceUnavailableException } from '@nestjs/common';
import { FacturaExtraida } from './extractor-factura.interface';

export const PROMPT_EXTRAER_FACTURA = `Esta imagen o documento es una factura o comprobante fiscal que un PROVEEDOR le emitió a una empresa en República Dominicana. Extraé los datos reales que aparezcan en el documento — nunca inventes un dato que no esté visible.

Buscá específicamente:
- Nombre o razón social del proveedor (quien EMITE la factura, no quien la recibe).
- RNC o Cédula del proveedor (formato dominicano: 9 u 11 dígitos, puede tener guiones).
- NCF o e-NCF (comprobante fiscal — empieza con una letra tipo B o E seguida de números, ej. B0100001234 o E310000001234).
- Fecha de emisión (convertila a formato YYYY-MM-DD).
- Un concepto breve (de qué se trata la compra, en pocas palabras).
- Subtotal (monto antes de impuestos).
- ITBIS (monto del impuesto, no el porcentaje).
- Total (monto final a pagar).

Si un campo no aparece visible o no podés leerlo con confianza, usá null para ese campo — NUNCA inventes un valor plausible.
Respondé ÚNICAMENTE con un JSON válido, sin texto antes ni después, con esta forma exacta:
{"proveedorNombre":"..." o null,"proveedorRnc":"..." o null,"ncf":"..." o null,"fecha":"YYYY-MM-DD" o null,"concepto":"..." o null,"subtotal":123.45 o null,"itbis":123.45 o null,"total":123.45 o null}`;

/**
 * Defensivo a propósito, mismo criterio que `parsearCandidatos` en
 * analizador-imagen.prompt.ts — un modelo puede envolver el JSON en texto
 * extra pese a que se le pidió que no lo haga. Nunca se devuelve al
 * frontend algo que no tenga exactamente la forma de `FacturaExtraida`
 * (campos ausentes o de tipo incorrecto quedan en `null`, no se descarta
 * toda la respuesta por un campo mal formado).
 */
export function parsearFacturaExtraida(textoCrudo: string, proveedor: string): FacturaExtraida {
  const inicio = textoCrudo.indexOf('{');
  const fin = textoCrudo.lastIndexOf('}');
  if (inicio === -1 || fin === -1 || fin < inicio) {
    throw new ServiceUnavailableException(`${proveedor} no devolvió un resultado que se pueda usar — probá de nuevo`);
  }

  let parseado: Record<string, unknown>;
  try {
    parseado = JSON.parse(textoCrudo.slice(inicio, fin + 1));
  } catch {
    throw new ServiceUnavailableException(`${proveedor} no devolvió un resultado que se pueda usar — probá de nuevo`);
  }

  const texto = (valor: unknown): string | null => (typeof valor === 'string' && valor.trim() ? valor.trim() : null);
  const numero = (valor: unknown): number | null => (typeof valor === 'number' && Number.isFinite(valor) ? valor : null);
  const fecha = (valor: unknown): string | null => (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null);

  return {
    proveedorNombre: texto(parseado.proveedorNombre),
    proveedorRnc: texto(parseado.proveedorRnc),
    ncf: texto(parseado.ncf),
    fecha: fecha(parseado.fecha),
    concepto: texto(parseado.concepto),
    subtotal: numero(parseado.subtotal),
    itbis: numero(parseado.itbis),
    total: numero(parseado.total),
  };
}
