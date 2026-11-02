import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GestionCobroService } from './gestion-cobro.service';
import { GestionCobroRepository } from './gestion-cobro.repository';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

describe('GestionCobroService', () => {
  let service: GestionCobroService;
  let repository: jest.Mocked<GestionCobroRepository>;
  let eventBus: jest.Mocked<EventBusService>;

  const cuenta = (overrides: Record<string, unknown> = {}) => ({
    id: 'cxc-1',
    clienteId: 'cliente-1',
    saldo: 500,
    estado: 'ABIERTA',
    ...overrides,
  });

  beforeEach(() => {
    repository = {
      buscarCuentaPorFacturaOrThrow: jest.fn().mockResolvedValue(cuenta()),
      crearGestion: jest.fn(),
      listarGestionesPorCuenta: jest.fn(),
      buscarProvisionPorCuenta: jest.fn().mockResolvedValue(null),
      crearProvision: jest.fn(),
      castigarEnTx: jest.fn(),
    } as unknown as jest.Mocked<GestionCobroRepository>;
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    service = new GestionCobroService(repository, eventBus);
  });

  describe('crearGestion', () => {
    it('resuelve la CuentaPorCobrar de la factura y crea la gestión', async () => {
      const dto = { facturaId: 'f1', tipo: 'LLAMADA', resultado: 'No contestó' } as never;
      repository.crearGestion.mockResolvedValue({ id: 'gestion-1' } as never);

      await service.crearGestion(dto, 'tenant-1', 'user-1');

      expect(repository.buscarCuentaPorFacturaOrThrow).toHaveBeenCalledWith('f1');
      expect(repository.crearGestion).toHaveBeenCalledWith(dto, 'tenant-1', 'cliente-1', 'cxc-1', 'user-1');
    });

    it('propaga 404 si la factura no tiene CuentaPorCobrar (ej. CONTADO)', async () => {
      repository.buscarCuentaPorFacturaOrThrow.mockRejectedValue(new NotFoundException());
      const dto = { facturaId: 'f1', tipo: 'LLAMADA', resultado: 'x' } as never;

      await expect(service.crearGestion(dto, 'tenant-1', 'user-1')).rejects.toThrow(NotFoundException);
      expect(repository.crearGestion).not.toHaveBeenCalled();
    });
  });

  describe('listarGestiones', () => {
    it('lista las gestiones de la CuentaPorCobrar resuelta por facturaId', async () => {
      repository.listarGestionesPorCuenta.mockResolvedValue([{ id: 'g1' }] as never);

      const resultado = await service.listarGestiones('f1');

      expect(repository.listarGestionesPorCuenta).toHaveBeenCalledWith('cxc-1');
      expect(resultado).toEqual([{ id: 'g1' }]);
    });
  });

  describe('provisionar (método de reserva — Fase 4)', () => {
    const dto = { facturaId: 'f1', motivo: 'Cliente en quiebra, sin respuesta en 6 meses' };

    it('crea la provisión con el saldo actual y emite CUENTA_POR_COBRAR_PROVISIONADA', async () => {
      repository.crearProvision.mockResolvedValue({ id: 'prov-1', monto: 500 } as never);

      await service.provisionar(dto, 'tenant-1', 'user-1');

      expect(repository.crearProvision).toHaveBeenCalledWith('cxc-1', 500, dto.motivo, 'tenant-1', 'user-1');
      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.CUENTA_POR_COBRAR_PROVISIONADA,
        expect.objectContaining({ tenantId: 'tenant-1', provisionId: 'prov-1', monto: '500' }),
      );
    });

    it('rechaza provisionar una cuenta ya PAGADA', async () => {
      repository.buscarCuentaPorFacturaOrThrow.mockResolvedValue(cuenta({ estado: 'PAGADA' }) as never);

      await expect(service.provisionar(dto, 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
      expect(repository.crearProvision).not.toHaveBeenCalled();
    });

    it('rechaza provisionar una cuenta que ya tiene una provisión activa', async () => {
      repository.buscarProvisionPorCuenta.mockResolvedValue({ id: 'prov-1', estado: 'PROVISIONADA' } as never);

      await expect(service.provisionar(dto, 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
      expect(repository.crearProvision).not.toHaveBeenCalled();
    });

    it('rechaza provisionar una cuenta ya castigada', async () => {
      repository.buscarProvisionPorCuenta.mockResolvedValue({ id: 'prov-1', estado: 'CASTIGADA' } as never);

      await expect(service.provisionar(dto, 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
      expect(repository.crearProvision).not.toHaveBeenCalled();
    });
  });

  describe('castigar', () => {
    const dto = { facturaId: 'f1' } as never;

    it('castiga la provisión activa y emite CUENTA_POR_COBRAR_CASTIGADA', async () => {
      repository.buscarProvisionPorCuenta.mockResolvedValue({ id: 'prov-1', estado: 'PROVISIONADA', monto: 500 } as never);
      repository.castigarEnTx.mockResolvedValue({ id: 'prov-1', estado: 'CASTIGADA' } as never);

      await service.castigar(dto, 'tenant-1');

      expect(repository.castigarEnTx).toHaveBeenCalledWith('prov-1', 'cxc-1');
      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.CUENTA_POR_COBRAR_CASTIGADA,
        expect.objectContaining({ tenantId: 'tenant-1', provisionId: 'prov-1', monto: '500' }),
      );
    });

    it('rechaza castigar si no hay ninguna provisión activa', async () => {
      repository.buscarProvisionPorCuenta.mockResolvedValue(null);

      await expect(service.castigar(dto, 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.castigarEnTx).not.toHaveBeenCalled();
    });

    it('rechaza castigar una provisión ya castigada antes', async () => {
      repository.buscarProvisionPorCuenta.mockResolvedValue({ id: 'prov-1', estado: 'CASTIGADA' } as never);

      await expect(service.castigar(dto, 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.castigarEnTx).not.toHaveBeenCalled();
    });
  });
});
