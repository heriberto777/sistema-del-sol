import { BadRequestException } from '@nestjs/common';
import { OportunidadesService } from './oportunidades.service';
import { OportunidadesRepository } from './oportunidades.repository';
import { EtapasPipelineService } from './etapas-pipeline.service';
import { LeadsService } from './leads.service';
import { ClientesService } from '../clientes/clientes.service';

describe('OportunidadesService', () => {
  let repository: jest.Mocked<OportunidadesRepository>;
  let etapasPipelineService: jest.Mocked<EtapasPipelineService>;
  let leadsService: jest.Mocked<LeadsService>;
  let clientesService: jest.Mocked<ClientesService>;
  let service: OportunidadesService;

  function dto(overrides: Record<string, unknown> = {}) {
    return {
      titulo: 'Venta anual',
      clienteId: 'cliente-1',
      etapaId: 'etapa-1',
      montoEstimado: 1000,
      fechaCierreEstimada: '2099-01-01',
      ...overrides,
    } as never;
  }

  beforeEach(() => {
    repository = {
      crear: jest.fn().mockResolvedValue({ id: 'op-1' }),
      listar: jest.fn(),
      listarPipeline: jest.fn(),
      listarCerradasRecientes: jest.fn().mockResolvedValue([]),
      buscarPorId: jest.fn(),
      actualizar: jest.fn(),
      cambiarEtapa: jest.fn(),
      cerrar: jest.fn(),
      eliminar: jest.fn(),
      validarVendedorDelTenant: jest.fn().mockResolvedValue({ id: 'user-2' }),
    } as unknown as jest.Mocked<OportunidadesRepository>;
    etapasPipelineService = {
      buscarPorId: jest.fn().mockResolvedValue({ id: 'etapa-1', probabilidadDefault: 30 }),
    } as unknown as jest.Mocked<EtapasPipelineService>;
    leadsService = { buscarPorId: jest.fn().mockResolvedValue({ id: 'lead-1' }) } as unknown as jest.Mocked<LeadsService>;
    clientesService = { buscarPorId: jest.fn().mockResolvedValue({ id: 'cliente-1' }) } as unknown as jest.Mocked<ClientesService>;
    service = new OportunidadesService(repository, etapasPipelineService, leadsService, clientesService);
  });

  describe('crear', () => {
    it('rechaza una oportunidad con cliente Y lead a la vez', async () => {
      await expect(service.crear(dto({ leadId: 'lead-1' }), 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('rechaza una oportunidad sin cliente ni lead', async () => {
      await expect(service.crear(dto({ clienteId: undefined }), 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('usa la probabilidad default de la etapa cuando no se especifica una propia', async () => {
      await service.crear(dto(), 'tenant-1', 'user-1');

      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ probabilidadPct: 30 }));
    });

    it('respeta probabilidadPct explícito en vez del default de la etapa', async () => {
      await service.crear(dto({ probabilidadPct: 75 }), 'tenant-1', 'user-1');

      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ probabilidadPct: 75 }));
    });

    it('asigna la oportunidad al usuario actual si no se especifica vendedorId', async () => {
      await service.crear(dto(), 'tenant-1', 'user-1');

      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ vendedorId: 'user-1' }));
    });
  });

  describe('cambiarEtapa / cerrar — oportunidad ya cerrada', () => {
    it('rechaza cambiar de etapa una oportunidad GANADA', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'op-1', estado: 'GANADA' } as never);

      await expect(service.cambiarEtapa('op-1', { etapaId: 'etapa-2' })).rejects.toThrow(BadRequestException);
    });

    it('rechaza volver a cerrar una oportunidad ya PERDIDA', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'op-1', estado: 'PERDIDA' } as never);

      await expect(service.cerrar('op-1', { estado: 'GANADA' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('cerrar', () => {
    it('exige motivoPerdida al marcar PERDIDA', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'op-1', estado: 'ABIERTA' } as never);

      await expect(service.cerrar('op-1', { estado: 'PERDIDA' })).rejects.toThrow(BadRequestException);
      expect(repository.cerrar).not.toHaveBeenCalled();
    });

    it('permite marcar GANADA sin motivoPerdida', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'op-1', estado: 'ABIERTA' } as never);

      await service.cerrar('op-1', { estado: 'GANADA' });

      expect(repository.cerrar).toHaveBeenCalledWith('op-1', 'GANADA', undefined);
    });
  });

  describe('eliminar', () => {
    it('rechaza eliminar una oportunidad que ya generó una cotización', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'op-1', cotizacionId: 'cot-1' } as never);

      await expect(service.eliminar('op-1')).rejects.toThrow(BadRequestException);
      expect(repository.eliminar).not.toHaveBeenCalled();
    });

    it('permite eliminar una oportunidad sin cotización asociada', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'op-1', cotizacionId: null } as never);

      await service.eliminar('op-1');

      expect(repository.eliminar).toHaveBeenCalledWith('op-1');
    });
  });
});
