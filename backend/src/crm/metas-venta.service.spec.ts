import { MetasVentaService } from './metas-venta.service';
import { MetasVentaRepository } from './metas-venta.repository';

describe('MetasVentaService', () => {
  let repository: jest.Mocked<MetasVentaRepository>;
  let service: MetasVentaService;

  beforeEach(() => {
    repository = {
      upsert: jest.fn().mockResolvedValue({ id: 'meta-1' }),
      listarPorPeriodo: jest.fn(),
      buscarPorId: jest.fn(),
      eliminar: jest.fn(),
      validarVendedorDelTenant: jest.fn().mockResolvedValue({ id: 'user-1' }),
      montoGanadoPorVendedor: jest.fn(),
    } as unknown as jest.Mocked<MetasVentaRepository>;
    service = new MetasVentaService(repository);
  });

  describe('crear', () => {
    it('valida que el vendedor pertenezca al tenant antes de crear/actualizar la meta', async () => {
      await service.crear({ vendedorId: 'user-1', anio: 2026, mes: 11, montoMeta: 50000 }, 'tenant-1');

      expect(repository.validarVendedorDelTenant).toHaveBeenCalledWith('user-1');
      expect(repository.upsert).toHaveBeenCalledWith({ vendedorId: 'user-1', anio: 2026, mes: 11, montoMeta: 50000 }, 'tenant-1');
    });
  });

  describe('listarPorPeriodo', () => {
    it('calcula el porcentaje cumplido comparando el monto real contra la meta', async () => {
      repository.listarPorPeriodo.mockResolvedValue([
        { id: 'meta-1', vendedorId: 'user-1', vendedor: { nombre: 'Juan' }, anio: 2026, mes: 11, montoMeta: '10000' },
      ] as never);
      repository.montoGanadoPorVendedor.mockResolvedValue(7500);

      const resultado = await service.listarPorPeriodo(2026, 11);

      expect(resultado).toEqual([
        { id: 'meta-1', vendedorId: 'user-1', nombre: 'Juan', anio: 2026, mes: 11, montoMeta: 10000, montoReal: 7500, porcentajeCumplido: 0.75 },
      ]);
    });

    it('no divide por cero si la meta quedó en 0', async () => {
      repository.listarPorPeriodo.mockResolvedValue([
        { id: 'meta-1', vendedorId: 'user-1', vendedor: { nombre: 'Juan' }, anio: 2026, mes: 11, montoMeta: '0' },
      ] as never);
      repository.montoGanadoPorVendedor.mockResolvedValue(0);

      const [resultado] = await service.listarPorPeriodo(2026, 11);

      expect(resultado.porcentajeCumplido).toBe(0);
    });
  });
});
