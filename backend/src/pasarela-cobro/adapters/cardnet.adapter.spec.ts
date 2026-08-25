process.env.ENCRYPTION_KEY = 'clave-de-prueba';

import { ServiceUnavailableException } from '@nestjs/common';
import { PasarelaConfigTenant, SesionCobroFactura } from '@prisma/client';
import { CardNetAdapter } from './cardnet.adapter';
import { cifrar } from '../../common/utils/encriptado.util';

const CONFIG_BASE: PasarelaConfigTenant = {
  id: 'p1',
  tenantId: 't1',
  pasarelaActiva: 'CARDNET',
  azulMerchantId: null,
  azulMerchantName: null,
  azulCurrencyCode: '$',
  azulAuthKeyCifrado: null,
  cardnetMerchantNumber: '349011300',
  cardnetMerchantTerminal: '00567856',
  cardnetMerchantTerminalAmex: null,
  cardnetMerchantName: 'Comercio Demo',
  cardnetMerchantType: '5440',
  cardnetAcquiringInstitutionCode: '349',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const SESION_BASE: SesionCobroFactura = {
  id: 's1',
  tenantId: 't1',
  facturaId: 'f1',
  pasarela: 'CARDNET',
  referenciaExterna: 'ref-1',
  monto: 100 as unknown as SesionCobroFactura['monto'],
  datosVerificacion: cifrar(JSON.stringify({ session: 'SESSION-1', sk: 'sk-1' })),
  estado: 'PENDIENTE',
  pagoId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CardNetAdapter', () => {
  let adapter: CardNetAdapter;
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    adapter = new CardNetAdapter();
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  describe('crearCheckout', () => {
    it('rechaza si el tenant no tiene CardNet configurado', async () => {
      await expect(
        adapter.crearCheckout({
          facturaId: 'f1',
          monto: 100,
          config: { ...CONFIG_BASE, cardnetMerchantNumber: null },
          urlRetorno: 'https://api.example.com/retorno',
          urlCancelacion: 'https://front.example.com/cancelado',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('crea la sesión y arma el formulario POST a /authorize', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ SESSION: 'SESSION-1', 'session-key': 'sk-1' }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const resultado = await adapter.crearCheckout({
        facturaId: 'f1',
        monto: 150.5,
        config: CONFIG_BASE,
        urlRetorno: 'https://api.example.com/cobros-publicos/cardnet/retorno',
        urlCancelacion: 'https://front.example.com/cancelado',
      });

      expect(resultado.metodo).toBe('POST');
      expect(resultado.url).toContain('/authorize');
      expect(resultado.campos).toEqual({ SESSION: 'SESSION-1' });
      expect(resultado.referenciaExterna).toEqual(expect.any(String));
      expect(resultado.datosVerificacion).toEqual(expect.any(String));

      const [, opciones] = fetchMock.mock.calls[0];
      const cuerpo = JSON.parse(opciones.body as string);
      expect(cuerpo.MerchantNumber).toBe('349011300');
      expect(cuerpo.MerchantTerminal).toBe('00567856');
      expect(cuerpo.Amount).toBe('15050');
      expect(cuerpo.ReturnUrl).toContain(`?ref=${resultado.referenciaExterna}`);
    });

    it('propaga error si CardNet rechaza la creación de sesión', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

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
  });

  describe('verificarRetorno', () => {
    it('ignora el query del retorno y siempre re-consulta a CardNet directo', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ResponseCode: '00' }) });
      global.fetch = fetchMock as unknown as typeof fetch;

      const resultado = await adapter.verificarRetorno({ estadoFalso: 'aprobado' }, SESION_BASE);

      expect(resultado.aprobado).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('SESSION-1?sk=sk-1'));
    });

    it('rechaza si ResponseCode no es 00', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ResponseCode: '05' }) }) as unknown as typeof fetch;

      const resultado = await adapter.verificarRetorno({}, SESION_BASE);
      expect(resultado.aprobado).toBe(false);
    });

    it('rechaza si la sesión ya expiró en CardNet (404)', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;

      const resultado = await adapter.verificarRetorno({}, SESION_BASE);
      expect(resultado.aprobado).toBe(false);
      expect(resultado.detalle).toMatch(/no encontrada|expirada/i);
    });

    it('rechaza si no hay datos de verificación guardados', async () => {
      const resultado = await adapter.verificarRetorno({}, { ...SESION_BASE, datosVerificacion: null });
      expect(resultado.aprobado).toBe(false);
    });
  });
});
