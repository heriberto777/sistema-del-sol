import { CuentasPorPagarService } from './cuentas-por-pagar.service';
import { CuentasPorPagarRepository } from './cuentas-por-pagar.repository';

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const hace = (dias: number) => new Date(Date.now() - dias * MS_POR_DIA);

describe('CuentasPorPagarService', () => {
  let service: CuentasPorPagarService;
  let repository: jest.Mocked<CuentasPorPagarRepository>;

  beforeEach(() => {
    repository = {
      listar: jest.fn().mockResolvedValue([[], 0]),
      listarTodasPendientes: jest.fn().mockResolvedValue([]),
      sumaPagosPorOrdenes: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<CuentasPorPagarRepository>;
    service = new CuentasPorPagarService(repository);
  });

  describe('listar', () => {
    it('resta los pagos parciales del total y calcula días vencidos contra fecha + proveedor.plazoPagoDias', async () => {
      repository.listar.mockResolvedValue([
        [{ id: 'o1', numero: '00010', fecha: hace(45), total: 1000, proveedor: { nombre: 'Proveedor X', plazoPagoDias: 30 } }],
        1,
      ] as never);
      repository.sumaPagosPorOrdenes.mockResolvedValue([{ ordenCompraId: 'o1', _sum: { monto: 400 } }] as never);

      const resultado = await service.listar({});

      expect(resultado.datos).toEqual([
        expect.objectContaining({
          id: 'o1',
          numero: '00010',
          proveedor: 'Proveedor X',
          total: 1000,
          pagado: 400,
          pendiente: 600,
          diasVencido: 15,
          bucket: 'D1_30',
        }),
      ]);
      expect(resultado.total).toBe(1);
    });

    it('sin pagos registrados, pendiente es igual al total', async () => {
      repository.listar.mockResolvedValue([
        [{ id: 'o1', numero: '00011', fecha: hace(5), total: 500, proveedor: { nombre: 'Proveedor Y', plazoPagoDias: 30 } }],
        1,
      ] as never);

      const resultado = await service.listar({});

      expect(resultado.datos[0]).toEqual(expect.objectContaining({ pagado: 0, pendiente: 500, bucket: 'CORRIENTE' }));
    });

    it('un plazo de pago por proveedor más largo empuja el vencimiento y baja el bucket', async () => {
      repository.listar.mockResolvedValue([
        [{ id: 'o1', numero: '00012', fecha: hace(45), total: 1000, proveedor: { nombre: 'Proveedor Z', plazoPagoDias: 60 } }],
        1,
      ] as never);

      const resultado = await service.listar({});

      expect(resultado.datos[0]).toEqual(expect.objectContaining({ bucket: 'CORRIENTE', diasVencido: -15 }));
    });

    it('pasa busqueda/paginación al repositorio', async () => {
      await service.listar({ busqueda: 'ACME', pagina: 2, tamanoPagina: 10 });

      expect(repository.listar).toHaveBeenCalledWith({ skip: 10, take: 10, busqueda: 'ACME' });
    });
  });

  describe('resumen', () => {
    it('agrupa en buckets de antigüedad y separa vencido de por-vencer', async () => {
      repository.listarTodasPendientes.mockResolvedValue([
        { id: 'o1', fecha: hace(45), total: 1000, proveedor: { plazoPagoDias: 30 } }, // 15 días vencida -> D1_30
        { id: 'o2', fecha: hace(5), total: 500, proveedor: { plazoPagoDias: 30 } }, // por vencer -> CORRIENTE
        { id: 'o3', fecha: hace(100), total: 300, proveedor: { plazoPagoDias: 30 } }, // 70 días vencida -> D61_90
      ] as never);
      repository.sumaPagosPorOrdenes.mockResolvedValue([{ ordenCompraId: 'o1', _sum: { monto: 200 } }] as never);

      const resumen = await service.resumen();

      expect(resumen.buckets).toEqual({ CORRIENTE: 500, D1_30: 800, D31_60: 0, D61_90: 300, D90_MAS: 0 });
      expect(resumen.totalCxP).toBe(1600);
      expect(resumen.totalVencido).toBe(1100);
      expect(resumen.totalPorVencer).toBe(500);
    });

    it('sin ninguna orden pendiente, todo queda en cero', async () => {
      const resumen = await service.resumen();

      expect(resumen).toEqual({ totalCxP: 0, totalVencido: 0, totalPorVencer: 0, buckets: { CORRIENTE: 0, D1_30: 0, D31_60: 0, D61_90: 0, D90_MAS: 0 } });
    });
  });
});
