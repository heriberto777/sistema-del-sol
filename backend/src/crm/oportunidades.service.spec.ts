import { BadRequestException } from '@nestjs/common';
import { OportunidadesService } from './oportunidades.service';
import { OportunidadesRepository } from './oportunidades.repository';
import { EtapasPipelineService } from './etapas-pipeline.service';
import { LeadsService } from './leads.service';
import { ClientesService } from '../clientes/clientes.service';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service';

describe('OportunidadesService', () => {
  let repository: jest.Mocked<OportunidadesRepository>;
  let etapasPipelineService: jest.Mocked<EtapasPipelineService>;
  let leadsService: jest.Mocked<LeadsService>;
  let clientesService: jest.Mocked<ClientesService>;
  let cotizacionesService: jest.Mocked<CotizacionesService>;
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
      vincularCotizacion: jest.fn().mockResolvedValue({ id: 'op-1', estado: 'ABIERTA' }),
      eliminar: jest.fn(),
      validarVendedorDelTenant: jest.fn().mockResolvedValue({ id: 'user-2' }),
    } as unknown as jest.Mocked<OportunidadesRepository>;
    etapasPipelineService = {
      buscarPorId: jest.fn().mockResolvedValue({ id: 'etapa-1', probabilidadDefault: 30 }),
    } as unknown as jest.Mocked<EtapasPipelineService>;
    leadsService = {
      buscarPorId: jest.fn().mockResolvedValue({ id: 'lead-1' }),
      convertir: jest.fn().mockResolvedValue({ id: 'cliente-del-lead' }),
    } as unknown as jest.Mocked<LeadsService>;
    clientesService = { buscarPorId: jest.fn().mockResolvedValue({ id: 'cliente-1' }) } as unknown as jest.Mocked<ClientesService>;
    cotizacionesService = { crear: jest.fn().mockResolvedValue({ id: 'cotizacion-1' }) } as unknown as jest.Mocked<CotizacionesService>;
    service = new OportunidadesService(repository, etapasPipelineService, leadsService, clientesService, cotizacionesService);
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

  describe('convertirEnCotizacion (Fase 2)', () => {
    it('genera la cotización directo contra el cliente cuando la oportunidad ya tiene uno', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'op-1',
        estado: 'ABIERTA',
        titulo: 'Venta anual',
        montoEstimado: '1500',
        clienteId: 'cliente-1',
        leadId: null,
      } as never);

      await service.convertirEnCotizacion('op-1', { fechaVigenciaHastaCotizacion: '2099-01-01' }, 'tenant-1', 'user-1');

      expect(leadsService.convertir).not.toHaveBeenCalled();
      expect(cotizacionesService.crear).toHaveBeenCalledWith(
        { clienteId: 'cliente-1', fechaVigenciaHasta: '2099-01-01', lineas: [{ descripcionManual: 'Venta anual', cantidad: 1, precioUnitario: 1500 }] },
        'tenant-1',
        'user-1',
      );
      expect(repository.vincularCotizacion).toHaveBeenCalledWith('op-1', 'cotizacion-1', undefined);
    });

    it('usa líneas reales del catálogo cuando se las pasan, en vez de la línea manual por defecto', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'op-1',
        estado: 'ABIERTA',
        titulo: 'Venta anual',
        montoEstimado: '1500',
        clienteId: 'cliente-1',
        leadId: null,
      } as never);
      const lineas = [{ productoId: 'prod-1', cantidad: 2 }];

      await service.convertirEnCotizacion('op-1', { fechaVigenciaHastaCotizacion: '2099-01-01', lineas } as never, 'tenant-1', 'user-1');

      expect(cotizacionesService.crear).toHaveBeenCalledWith(
        expect.objectContaining({ lineas }),
        'tenant-1',
        'user-1',
      );
    });

    it('convierte el lead en cliente primero cuando la oportunidad todavía no tiene cliente', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'op-1',
        estado: 'ABIERTA',
        titulo: 'Venta mayorista',
        montoEstimado: '3000',
        clienteId: null,
        leadId: 'lead-1',
      } as never);

      await service.convertirEnCotizacion('op-1', { fechaVigenciaHastaCotizacion: '2099-01-01', tipoClienteNuevo: 'PERSONA_JURIDICA' }, 'tenant-1', 'user-1');

      expect(leadsService.convertir).toHaveBeenCalledWith('lead-1', { tipo: 'PERSONA_JURIDICA', rncCedula: undefined }, 'tenant-1');
      expect(cotizacionesService.crear).toHaveBeenCalledWith(
        expect.objectContaining({ clienteId: 'cliente-del-lead' }),
        'tenant-1',
        'user-1',
      );
      expect(repository.vincularCotizacion).toHaveBeenCalledWith('op-1', 'cotizacion-1', 'cliente-del-lead');
    });

    it('rechaza convertir una oportunidad que ya está cerrada', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'op-1', estado: 'GANADA' } as never);

      await expect(service.convertirEnCotizacion('op-1', { fechaVigenciaHastaCotizacion: '2099-01-01' }, 'tenant-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(cotizacionesService.crear).not.toHaveBeenCalled();
    });
  });
});
