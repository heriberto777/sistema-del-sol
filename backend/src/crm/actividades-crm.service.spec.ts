import { BadRequestException } from '@nestjs/common';
import { ActividadesCrmService } from './actividades-crm.service';
import { ActividadesCrmRepository } from './actividades-crm.repository';
import { ClientesService } from '../clientes/clientes.service';
import { LeadsService } from './leads.service';
import { OportunidadesService } from './oportunidades.service';

describe('ActividadesCrmService', () => {
  let repository: jest.Mocked<ActividadesCrmRepository>;
  let clientesService: jest.Mocked<ClientesService>;
  let leadsService: jest.Mocked<LeadsService>;
  let oportunidadesService: jest.Mocked<OportunidadesService>;
  let service: ActividadesCrmService;

  beforeEach(() => {
    repository = {
      crear: jest.fn().mockResolvedValue({ id: 'act-1' }),
      listar: jest.fn(),
      buscarPorId: jest.fn().mockResolvedValue({ id: 'act-1' }),
      marcarCompletada: jest.fn(),
      eliminar: jest.fn(),
    } as unknown as jest.Mocked<ActividadesCrmRepository>;
    clientesService = { buscarPorId: jest.fn().mockResolvedValue({ id: 'cliente-1' }) } as unknown as jest.Mocked<ClientesService>;
    leadsService = { buscarPorId: jest.fn().mockResolvedValue({ id: 'lead-1' }) } as unknown as jest.Mocked<LeadsService>;
    oportunidadesService = { buscarPorId: jest.fn().mockResolvedValue({ id: 'op-1' }) } as unknown as jest.Mocked<OportunidadesService>;
    service = new ActividadesCrmService(repository, clientesService, leadsService, oportunidadesService);
  });

  const base = { tipo: 'LLAMADA', descripcion: 'Llamé para seguimiento' };

  it('rechaza una actividad sin ninguna referencia (ni cliente, ni lead, ni oportunidad)', async () => {
    await expect(service.crear(base as never, 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
  });

  it('rechaza una actividad con más de una referencia a la vez', async () => {
    await expect(service.crear({ ...base, clienteId: 'cliente-1', leadId: 'lead-1' } as never, 'tenant-1', 'user-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('acepta una actividad ligada a exactamente un cliente', async () => {
    await service.crear({ ...base, clienteId: 'cliente-1' } as never, 'tenant-1', 'user-1');

    expect(clientesService.buscarPorId).toHaveBeenCalledWith('cliente-1');
    expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ clienteId: 'cliente-1', tenantId: 'tenant-1', usuarioId: 'user-1' }));
  });

  it('acepta una actividad ligada a exactamente una oportunidad', async () => {
    await service.crear({ ...base, oportunidadId: 'op-1' } as never, 'tenant-1', 'user-1');

    expect(oportunidadesService.buscarPorId).toHaveBeenCalledWith('op-1');
    expect(repository.crear).toHaveBeenCalled();
  });
});
