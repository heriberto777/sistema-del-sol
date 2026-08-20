import { BadRequestException } from '@nestjs/common';
import { BonosService } from './bonos.service';
import { BonosRepository } from './bonos.repository';

describe('BonosService', () => {
  let service: BonosService;
  let repository: jest.Mocked<BonosRepository>;

  function bono(overrides: Record<string, unknown> = {}) {
    return {
      id: 'bono-1',
      tenantId: 'tenant-1',
      codigo: 'BONO-AAAAAAAA',
      montoInicial: 1000,
      saldoActual: 1000,
      fechaVencimiento: new Date('2099-01-01'),
      estado: 'ACTIVO',
      ...overrides,
    };
  }

  beforeEach(() => {
    repository = {
      crearLote: jest.fn().mockResolvedValue([]),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      anular: jest.fn(),
      buscarPorCodigoEnTx: jest.fn(),
      descontarSaldoEnTx: jest.fn(),
    } as unknown as jest.Mocked<BonosRepository>;
    service = new BonosService(repository);
  });

  describe('emitirLote', () => {
    it('genera exactamente `cantidad` bonos con códigos únicos', async () => {
      await service.emitirLote({ cantidad: 20, montoPorBono: 500, fechaVencimiento: new Date('2027-01-01') }, 'tenant-1');

      expect(repository.crearLote).toHaveBeenCalledTimes(1);
      const lote = repository.crearLote.mock.calls[0][0];
      expect(lote).toHaveLength(20);
      const codigos = new Set(lote.map((b) => b.codigo));
      expect(codigos.size).toBe(20);
      expect(lote.every((b) => b.montoInicial === 500 && b.tenantId === 'tenant-1')).toBe(true);
    });
  });

  describe('anular', () => {
    it('rechaza anular un bono que ya está anulado', async () => {
      repository.buscarPorId.mockResolvedValue(bono({ estado: 'ANULADO' }) as never);

      await expect(service.anular('bono-1')).rejects.toThrow(BadRequestException);
      expect(repository.anular).not.toHaveBeenCalled();
    });

    it('anula un bono activo', async () => {
      repository.buscarPorId.mockResolvedValue(bono() as never);

      await service.anular('bono-1');

      expect(repository.anular).toHaveBeenCalledWith('bono-1');
    });
  });

  describe('procesarPagoEnTx', () => {
    function tx(formaPagoEsBono: boolean) {
      return { formaPago: { findUnique: jest.fn().mockResolvedValue({ esBono: formaPagoEsBono }) } } as never;
    }

    it('no hace nada si la forma de pago no es Bono', async () => {
      await service.procesarPagoEnTx(tx(false), 'tenant-1', { formaPagoId: 'fp-1', monto: 100, referencia: 'BONO-X' });

      expect(repository.buscarPorCodigoEnTx).not.toHaveBeenCalled();
    });

    it('rechaza si es Bono pero no viene referencia (código)', async () => {
      await expect(
        service.procesarPagoEnTx(tx(true), 'tenant-1', { formaPagoId: 'fp-1', monto: 100 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si el código no corresponde a ningún bono', async () => {
      repository.buscarPorCodigoEnTx.mockResolvedValue(null);

      await expect(
        service.procesarPagoEnTx(tx(true), 'tenant-1', { formaPagoId: 'fp-1', monto: 100, referencia: 'BONO-NOEXISTE' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza un bono anulado', async () => {
      repository.buscarPorCodigoEnTx.mockResolvedValue(bono({ estado: 'ANULADO' }) as never);

      await expect(
        service.procesarPagoEnTx(tx(true), 'tenant-1', { formaPagoId: 'fp-1', monto: 100, referencia: 'BONO-AAAAAAAA' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza un bono vencido por fecha aunque el estado todavía diga ACTIVO (ventana antes del cron diario)', async () => {
      repository.buscarPorCodigoEnTx.mockResolvedValue(bono({ estado: 'ACTIVO', fechaVencimiento: new Date('2020-01-01') }) as never);

      await expect(
        service.procesarPagoEnTx(tx(true), 'tenant-1', { formaPagoId: 'fp-1', monto: 100, referencia: 'BONO-AAAAAAAA' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si el saldo no alcanza', async () => {
      repository.buscarPorCodigoEnTx.mockResolvedValue(bono({ saldoActual: 50 }) as never);

      await expect(
        service.procesarPagoEnTx(tx(true), 'tenant-1', { formaPagoId: 'fp-1', monto: 100, referencia: 'BONO-AAAAAAAA' }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.descontarSaldoEnTx).not.toHaveBeenCalled();
    });

    it('descuenta el saldo y deja el bono ACTIVO si queda saldo remanente', async () => {
      repository.buscarPorCodigoEnTx.mockResolvedValue(bono({ saldoActual: 1000 }) as never);
      const txClient = tx(true);

      await service.procesarPagoEnTx(txClient, 'tenant-1', { formaPagoId: 'fp-1', monto: 300, referencia: 'BONO-AAAAAAAA' });

      expect(repository.descontarSaldoEnTx).toHaveBeenCalledWith(txClient, 'bono-1', 700, 'ACTIVO');
    });

    it('marca AGOTADO cuando el canje consume el saldo completo', async () => {
      repository.buscarPorCodigoEnTx.mockResolvedValue(bono({ saldoActual: 300 }) as never);
      const txClient = tx(true);

      await service.procesarPagoEnTx(txClient, 'tenant-1', { formaPagoId: 'fp-1', monto: 300, referencia: 'BONO-AAAAAAAA' });

      expect(repository.descontarSaldoEnTx).toHaveBeenCalledWith(txClient, 'bono-1', 0, 'AGOTADO');
    });
  });
});
