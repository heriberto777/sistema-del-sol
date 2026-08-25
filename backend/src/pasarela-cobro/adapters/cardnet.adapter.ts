import { randomBytes, randomInt } from 'crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SesionCobroFactura } from '@prisma/client';
import { PasarelaCobroAdapter, CrearCheckoutParams, ResultadoCheckoutCobro, ResultadoVerificacionCobro } from './pasarela-cobro-adapter.interface';
import { cifrar, descifrar } from '../../common/utils/encriptado.util';

const URL_BASE = process.env.CARDNET_API_URL ?? 'https://labservicios.cardnet.com.do';

/**
 * CardNet "Botón de Pago — Web con Pantalla" (contrato tomado de
 * developers.cardnet.com.do/guias/boton-de-pago/web-con-pantalla-post-3ds.html,
 * no de un SDK — CardNet no publica uno para Node.js). A diferencia de
 * AZUL, esta API **no firma nada** (TLS 1.2 + MerchantNumber/
 * MerchantTerminal como credencial, sin AuthHash) y **no empuja
 * resultado** — el flujo es:
 *   1. `POST {urlbase}/sessions` (JSON) → `{ SESSION, "session-key" }`.
 *   2. Formulario POST a `{urlbase}/authorize` con el `SESSION` como
 *      único campo — el cliente completa el pago en la pantalla
 *      hospedada de CardNet.
 *   3. El resultado NUNCA llega confiable por el `ReturnUrl` (no hay
 *      params documentados, y aunque los hubiera no vienen firmados) —
 *      hay que re-consultar `GET {urlbase}/sessions/{SESSION}?sk=
 *      {session-key}` para el resultado autoritativo. Por eso acá
 *      `verificarRetorno` ignora casi por completo el `query` del
 *      retorno (excepto para correlacionar qué `SesionCobroFactura` es)
 *      y siempre re-consulta contra CardNet directo.
 *
 * Como el `ReturnUrl` no trae ningún identificador utilizable de forma
 * confiable, la correlación real la arma este módulo: `referenciaExterna`
 * es una referencia PROPIA (no la `SESSION` de CardNet) que se manda como
 * `OrdenId` y como query param `?ref=` del propio `ReturnUrl` — la
 * `SESSION`/`session-key` reales de CardNet (necesarias para el paso 3)
 * se guardan cifradas en `SesionCobroFactura.datosVerificacion`.
 */
@Injectable()
export class CardNetAdapter implements PasarelaCobroAdapter {
  readonly clave = 'CARDNET' as const;

  async crearCheckout(params: CrearCheckoutParams): Promise<ResultadoCheckoutCobro> {
    const { config, monto, urlRetorno, urlCancelacion } = params;
    if (!config.cardnetMerchantNumber || !config.cardnetMerchantTerminal) {
      throw new ServiceUnavailableException('CardNet no está configurado para este negocio');
    }

    const referenciaPropia = randomBytes(8).toString('hex');
    const respuesta = await fetch(`${URL_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        TransactionType: '0200', // venta normal
        CurrencyCode: '214', // ISO 4217 numérico — DOP
        AcquiringInstitutionCode: config.cardnetAcquiringInstitutionCode ?? '',
        MerchantType: config.cardnetMerchantType ?? '',
        MerchantNumber: config.cardnetMerchantNumber,
        MerchantTerminal: config.cardnetMerchantTerminal,
        ...(config.cardnetMerchantTerminalAmex ? { MerchantTerminal_amex: config.cardnetMerchantTerminalAmex } : {}),
        ReturnUrl: `${urlRetorno}?ref=${referenciaPropia}`,
        CancelUrl: urlCancelacion,
        PageLanguaje: 'ESP',
        OrdenId: referenciaPropia,
        TransactionId: String(randomInt(100000, 999999)),
        // Mismo criterio que AZUL: se cobra un monto ya facturado
        // (posiblemente parcial) contra un documento con su propio
        // desglose de ITBIS — no hay impuesto propio de este pago puntual.
        Tax: '000000000000',
        MerchantName: config.cardnetMerchantName ?? '',
        Amount: formatearMontoCardNet(monto),
      }),
    });

    if (!respuesta.ok) {
      throw new ServiceUnavailableException('No se pudo iniciar la sesión de pago con CardNet');
    }
    const datos = (await respuesta.json()) as { SESSION: string; 'session-key': string };

    return {
      metodo: 'POST',
      url: `${URL_BASE}/authorize`,
      campos: { SESSION: datos.SESSION },
      referenciaExterna: referenciaPropia,
      datosVerificacion: cifrar(JSON.stringify({ session: datos.SESSION, sk: datos['session-key'] })),
    };
  }

  // `query`/`config` no se usan (ver disclaimer arriba: nunca se confía en
  // el query del retorno, solo en la sesión persistida) — se omiten del
  // todo en vez de nombrarlos "_x", válido en TS/JS (una función con menos
  // parámetros es asignable al tipo de la interfaz que espera más).
  async verificarRetorno(_query: Record<string, string>, sesion: SesionCobroFactura): Promise<ResultadoVerificacionCobro> {
    if (!sesion.datosVerificacion) {
      return { aprobado: false, detalle: 'Sesión sin datos de verificación de CardNet' };
    }
    const { session, sk } = JSON.parse(descifrar(sesion.datosVerificacion)) as { session: string; sk: string };

    const respuesta = await fetch(`${URL_BASE}/sessions/${session}?sk=${sk}`);
    if (respuesta.status === 404) {
      return { aprobado: false, detalle: 'Sesión no encontrada o expirada en CardNet' };
    }
    if (!respuesta.ok) {
      return { aprobado: false, detalle: `CardNet respondió ${respuesta.status} al consultar la sesión` };
    }
    const datos = (await respuesta.json()) as { ResponseCode?: string };
    return { aprobado: datos.ResponseCode === '00', detalle: datos.ResponseCode };
  }
}

/** Mismo formato que AZUL: entero de centavos, sin coma ni punto — ej. 881.00 = "88100". */
function formatearMontoCardNet(monto: number): string {
  return Math.round(monto * 100).toString();
}
