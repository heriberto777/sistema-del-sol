import { AuditoriaService } from './auditoria.service';
import { AuditoriaRepository } from './auditoria.repository';

describe('AuditoriaService', () => {
  let repository: jest.Mocked<AuditoriaRepository>;
  let service: AuditoriaService;

  beforeEach(() => {
    repository = {
      listarActividad: jest.fn().mockResolvedValue({ datos: [], total: 0 }),
      listarUsuariosConActividad: jest.fn().mockResolvedValue([]),
      listarErrores: jest.fn().mockResolvedValue({ datos: [], total: 0 }),
    } as unknown as jest.Mocked<AuditoriaRepository>;
    service = new AuditoriaService(repository);
  });

  it('listarActividad pagina con los defaults y propaga los filtros al repositorio', async () => {
    await service.listarActividad({ usuarioId: 'u1', busqueda: 'factura', desde: '2026-01-01', hasta: '2026-01-31' });

    expect(repository.listarActividad).toHaveBeenCalledWith({
      skip: 0,
      take: 20,
      busqueda: 'factura',
      usuarioId: 'u1',
      desde: '2026-01-01',
      hasta: '2026-01-31',
    });
  });

  it('listarErrores respeta la página/tamaño pedidos', async () => {
    await service.listarErrores({ pagina: 3, tamanoPagina: 10, busqueda: 'timeout' });

    expect(repository.listarErrores).toHaveBeenCalledWith({ skip: 20, take: 10, busqueda: 'timeout', desde: undefined, hasta: undefined });
  });
});
