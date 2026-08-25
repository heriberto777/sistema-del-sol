import { randomBytes } from 'crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PasarelaConfigTenant, SesionCobroFactura } from '@prisma/client';
import { PasarelaCobroAdapter, CrearCheckoutParams, ResultadoCheckoutCobro, ResultadoVerificacionCobro } from './pasarela-cobro-adapter.interface';
import { calcularHashAzul, compararHashesAzul, formatearMontoAzul } from './azul-hash.util';
import { descifrar } from '../../common/utils/encriptado.util';

/**
 * AZUL "Página de Pagos" — formulario HTML firmado, sin sesión de
 * servidor (a diferencia de CardNet). "Si es satisfactorio, se recibe 00"
 * en IsoCode — esa es la señal de aprobación que usa este adapter
 * (ResponseCode es un texto humano, IsoCode es el código autoritativo
 * tipo ISO 8583). Ver azul-hash.util.ts para el detalle del AuthHash.
 */
@Injectable()
export class AzulAdapter implements PasarelaCobroAdapter {
  readonly clave = 'AZUL' as const;

  async crearCheckout(params: CrearCheckoutParams): Promise<ResultadoCheckoutCobro> {
    const { config, monto, urlRetorno, urlCancelacion } = params;
    if (!config.azulMerchantId || !config.azulAuthKeyCifrado) {
      throw new ServiceUnavailableException('AZUL no está configurado para este negocio');
    }
    const authKey = descifrar(config.azulAuthKeyCifrado);
    const orderNumber = randomBytes(8).toString('hex');

    const campos: Record<string, string> = {
      MerchantId: config.azulMerchantId,
      MerchantName: config.azulMerchantName ?? '',
      MerchantType: 'ECommerce',
      CurrencyCode: config.azulCurrencyCode ?? '$',
      OrderNumber: orderNumber,
      Amount: formatearMontoAzul(monto),
      // Se cobra el monto ya facturado (posiblemente parcial) contra un
      // documento ya emitido con su propio desglose de ITBIS — no hay un
      // ITBIS propio de "este pago puntual" que calcular de nuevo.
      ITBIS: '000',
      ApprovedUrl: urlRetorno,
      DeclinedUrl: urlRetorno,
      CancelUrl: urlCancelacion,
      UseCustomField1: '0',
      CustomField1Label: '',
      CustomField1Value: '',
      UseCustomField2: '0',
      CustomField2Label: '',
      CustomField2Value: '',
    };

    campos.AuthHash = calcularHashAzul(
      [
        campos.MerchantId,
        campos.MerchantName,
        campos.MerchantType,
        campos.CurrencyCode,
        campos.OrderNumber,
        campos.Amount,
        campos.ITBIS,
        campos.ApprovedUrl,
        campos.DeclinedUrl,
        campos.CancelUrl,
        campos.UseCustomField1,
        campos.CustomField1Label,
        campos.CustomField1Value,
        campos.UseCustomField2,
        campos.CustomField2Label,
        campos.CustomField2Value,
      ],
      authKey,
    );

    return {
      metodo: 'POST',
      url: process.env.AZUL_PAYMENT_PAGE_URL ?? 'https://pruebas.azul.com.do/PaymentPage/',
      campos,
      referenciaExterna: orderNumber,
    };
  }

  async verificarRetorno(
    query: Record<string, string>,
    _sesion: SesionCobroFactura,
    config: PasarelaConfigTenant,
  ): Promise<ResultadoVerificacionCobro> {
    if (!config.azulAuthKeyCifrado) {
      return { aprobado: false, detalle: 'AZUL sin AuthKey configurada' };
    }
    const authKey = descifrar(config.azulAuthKeyCifrado);
    const hashEsperado = calcularHashAzul(
      [
        query.OrderNumber ?? '',
        query.Amount ?? '',
        query.AuthorizationCode ?? '',
        query.DateTime ?? '',
        query.ResponseCode ?? '',
        query.IsoCode ?? '',
        query.ResponseMessage ?? '',
        query.ErrorDescription ?? '',
        query.RRN ?? '',
      ],
      authKey,
    );

    if (!compararHashesAzul(hashEsperado, query.AuthHash ?? '')) {
      return { aprobado: false, detalle: 'AuthHash de retorno inválido' };
    }
    return { aprobado: query.IsoCode === '00', detalle: query.ResponseMessage };
  }
}
