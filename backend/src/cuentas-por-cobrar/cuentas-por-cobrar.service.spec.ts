import { CuentasPorCobrarService } from './cuentas-por-cobrar.service';
import { CuentasPorCobrarRepository } from './cuentas-por-cobrar.repository';

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const hace = (dias: number) => new Date(Date.now() - dias * MS_POR_DIA);

describe('CuentasPorCobrarService', () => {
  let service: CuentasPorCobrarService;
  let repository: jest.Mocked<CuentasPorCobrarRepository>;

  beforeEach(() => {
    repository = {
      listar: jest.fn().mockResolvedValue([[], 0]),
      listarTodasPendientes: jest.fn().mockResolvedValue([]),
      sumaPagosPorFacturas: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<CuentasPorCobrarRepository>;
    service = new CuentasPorCobrarService(repository);
  });

  describe('listar', () => {
    it('resta los pagos parciales del total y calcula días vencidos contra fecha + plazoPagoDias', async () => {
      repository.listar.mockResolvedValue([
        [{ id: 'f1', numero: '00010', ncf: 'B0200000001', fecha: hace(45), plazoPagoDias: 30, total: 1000, cliente: { nombre: 'Cliente X' } }],
        1,
      ] as never);
      repository.sumaPagosPorFacturas.mockResolvedValue([{ facturaId: 'f1', _sum: { monto: 400 } }] as never);

      const resultado = await service.listar({});

      expect(resultado.datos).toEqual([
        expect.objectContaining({
          id: 'f1',
          numero: '00010',
          cliente: 'Cliente X',
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
        [{ id: 'f1', numero: '00011', ncf: null, fecha: hace(5), plazoPagoDias: 30, total: 500, cliente: { nombre: 'Cliente Y' } }],
        1,
      ] as never);

      const resultado = await service.listar({});

      expect(resultado.datos[0]).toEqual(expect.objectContaining({ pagado: 0, pendiente: 500, bucket: 'CORRIENTE' }));
    });

    it('pasa busqueda/paginación al repositorio', async () => {
      await service.listar({ busqueda: 'ACME', pagina: 2, tamanoPagina: 10 });

      expect(repository.listar).toHaveBeenCalledWith({ skip: 10, take: 10, busqueda: 'ACME' });
    });
  });

  describe('resumen', () => {
    it('agrupa en buckets de antigüedad y separa vencido de por-vencer', async () => {
      repository.listarTodasPendientes.mockResolvedValue([
        { id: 'f1', fecha: hace(45), plazoPagoDias: 30, total: 1000 }, // 15 días vencida -> D1_30
        { id: 'f2', fecha: hace(5), plazoPagoDias: 30, total: 500 }, // por vencer -> CORRIENTE
        { id: 'f3', fecha: hace(100), plazoPagoDias: 30, total: 300 }, // 70 días vencida -> D61_90
      ] as never);
      repository.sumaPagosPorFacturas.mockResolvedValue([{ facturaId: 'f1', _sum: { monto: 200 } }] as never);

      const resumen = await service.resumen();

      expect(resumen.buckets).toEqual({ CORRIENTE: 500, D1_30: 800, D31_60: 0, D61_90: 300, D90_MAS: 0 });
      expect(resumen.totalCxC).toBe(1600);
      expect(resumen.totalVencido).toBe(1100);
      expect(resumen.totalPorVencer).toBe(500);
    });

    it('sin ninguna factura pendiente, todo queda en cero', async () => {
      const resumen = await service.resumen();

      expect(resumen).toEqual({ totalCxC: 0, totalVencido: 0, totalPorVencer: 0, buckets: { CORRIENTE: 0, D1_30: 0, D31_60: 0, D61_90: 0, D90_MAS: 0 } });
    });
  });
});
