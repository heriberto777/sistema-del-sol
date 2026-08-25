import { ServiceUnavailableException } from '@nestjs/common';
import { PasarelaConfigTenant, SesionCobroFactura } from '@prisma/client';
import { AzulAdapter } from './azul.adapter';
import { calcularHashAzul } from './azul-hash.util';
import { cifrar } from '../../common/utils/encriptado.util';

process.env.ENCRYPTION_KEY = 'clave-de-prueba';

const AUTH_KEY = 'clave-de-prueba-azul';

const CONFIG_BASE: PasarelaConfigTenant = {
  id: 'p1',
  tenantId: 't1',
  pasarelaActiva: 'AZUL',
  azulMerchantId: '99999999999',
  azulMerchantName: 'Comercio Demo',
  azulCurrencyCode: '$',
  azulAuthKeyCifrado: null,
  cardnetMerchantNumber: null,
  cardnetMerchantTerminal: null,
  cardnetMerchantTerminalAmex: null,
  cardnetMerchantName: null,
  cardnetMerchantType: null,
  cardnetAcquiringInstitutionCode: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const SESION_BASE: SesionCobroFactura = {
  id: 's1',
  tenantId: 't1',
  facturaId: 'f1',
  pasarela: 'AZUL',
  referenciaExterna: 'orden-1',
  monto: 100 as unknown as SesionCobroFactura['monto'],
  datosVerificacion: null,
  estado: 'PENDIENTE',
  pagoId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AzulAdapter', () => {
  let adapter: AzulAdapter;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'clave-de-prueba';
    adapter = new AzulAdapter();
  });

  describe('crearCheckout', () => {
    it('rechaza si el tenant no tiene AZUL configurado', async () => {
      await expect(
        adapter.crearCheckout({
          facturaId: 'f1',
          monto: 100,
          config: CONFIG_BASE,
          urlRetorno: 'https://api.example.com/retorno',
          urlCancelacion: 'https://front.example.com/cancelado',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('arma un formulario POST con AuthHash válido', async () => {
      const config = { ...CONFIG_BASE, azulAuthKeyCifrado: cifrar(AUTH_KEY) };

      const resultado = await adapter.crearCheckout({
        facturaId: 'f1',
        monto: 150.5,
        config,
        urlRetorno: 'https://api.example.com/retorno',
        urlCancelacion: 'https://front.example.com/cancelado',
      });

      expect(resultado.metodo).toBe('POST');
      expect(resultado.campos?.Amount).toBe('15050');
      expect(resultado.campos?.MerchantId).toBe('99999999999');
      expect(resultado.referenciaExterna).toBe(resultado.campos?.OrderNumber);

      const hashEsperado = calcularHashAzul(
        [
          resultado.campos!.MerchantId,
          resultado.campos!.MerchantName,
          resultado.campos!.MerchantType,
          resultado.campos!.CurrencyCode,
          resultado.campos!.OrderNumber,
          resultado.campos!.Amount,
          resultado.campos!.ITBIS,
          resultado.campos!.ApprovedUrl,
          resultado.campos!.DeclinedUrl,
          resultado.campos!.CancelUrl,
          resultado.campos!.UseCustomField1,
          resultado.campos!.CustomField1Label,
          resultado.campos!.CustomField1Value,
          resultado.campos!.UseCustomField2,
          resultado.campos!.CustomField2Label,
          resultado.campos!.CustomField2Value,
        ],
        AUTH_KEY,
      );
      expect(resultado.campos?.AuthHash).toBe(hashEsperado);
    });
  });

  describe('verificarRetorno', () => {
    const config = { ...CONFIG_BASE, azulAuthKeyCifrado: cifrar(AUTH_KEY) };

    function respuestaFirmada(overrides: Partial<Record<string, string>> = {}) {
      const base = {
        OrderNumber: 'orden-1',
        Amount: '15050',
        AuthorizationCode: 'AUTH123',
        DateTime: '20260101120000',
        ResponseCode: 'APROBADA',
        IsoCode: '00',
        ResponseMessage: 'APROBADA',
        ErrorDescription: '',
        RRN: 'RRN123',
        ...overrides,
      };
      const hash = calcularHashAzul(
        [base.OrderNumber, base.Amount, base.AuthorizationCode, base.DateTime, base.ResponseCode, base.IsoCode, base.ResponseMessage, base.ErrorDescription, base.RRN],
        AUTH_KEY,
      );
      return { ...base, AuthHash: overrides.AuthHash ?? hash };
    }

    it('aprueba cuando el hash es válido e IsoCode=00', async () => {
      const resultado = await adapter.verificarRetorno(respuestaFirmada(), SESION_BASE, config);
      expect(resultado.aprobado).toBe(true);
    });

    it('rechaza cuando IsoCode no es 00, aunque el hash sea válido', async () => {
      const resultado = await adapter.verificarRetorno(respuestaFirmada({ IsoCode: '05', ResponseMessage: 'DECLINADA' }), SESION_BASE, config);
      expect(resultado.aprobado).toBe(false);
    });

    it('rechaza si el AuthHash fue manipulado (monto alterado sin recalcular el hash)', async () => {
      const query = respuestaFirmada();
      const resultado = await adapter.verificarRetorno({ ...query, Amount: '999999' }, SESION_BASE, config);
      expect(resultado.aprobado).toBe(false);
      expect(resultado.detalle).toMatch(/inválido/i);
    });
  });
});
