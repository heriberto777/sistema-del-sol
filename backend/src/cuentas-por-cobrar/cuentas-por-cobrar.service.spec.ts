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
    } as unknown as jest.Mocked<CuentasPorCobrarRepository>;
    service = new CuentasPorCobrarService(repository);
  });

  describe('listar', () => {
    it('CxC como ledger real (Fase 1): lee saldo/fechaVencimiento directo de CuentaPorCobrar, sin recalcular Pago', async () => {
      repository.listar.mockResolvedValue([
        [
          {
            facturaId: 'f1',
            factura: { numero: '00010', ncf: 'B0200000001' },
            cliente: { nombre: 'Cliente X' },
            fecha: hace(45),
            fechaVencimiento: hace(15),
            monto: 1000,
            saldo: 600,
          },
        ],
        1,
      ] as never);

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

    it('sin pagos registrados, pendiente es igual al monto', async () => {
      repository.listar.mockResolvedValue([
        [
          {
            facturaId: 'f1',
            factura: { numero: '00011', ncf: null },
            cliente: { nombre: 'Cliente Y' },
            fecha: hace(5),
            fechaVencimiento: hace(-25),
            monto: 500,
            saldo: 500,
          },
        ],
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
    it('agrupa en buckets de antigüedad y separa vencido de por-vencer, usando el saldo ya almacenado', async () => {
      repository.listarTodasPendientes.mockResolvedValue([
        { id: 'c1', saldo: 800, fechaVencimiento: hace(15) }, // 15 días vencida -> D1_30
        { id: 'c2', saldo: 500, fechaVencimiento: hace(-25) }, // por vencer -> CORRIENTE
        { id: 'c3', saldo: 300, fechaVencimiento: hace(70) }, // 70 días vencida -> D61_90
      ] as never);

      const resumen = await service.resumen();

      expect(resumen.buckets).toEqual({ CORRIENTE: 500, D1_30: 800, D31_60: 0, D61_90: 300, D90_MAS: 0 });
      expect(resumen.totalCxC).toBe(1600);
      expect(resumen.totalVencido).toBe(1100);
      expect(resumen.totalPorVencer).toBe(500);
    });

    it('sin ninguna CuentaPorCobrar pendiente, todo queda en cero', async () => {
      const resumen = await service.resumen();

      expect(resumen).toEqual({ totalCxC: 0, totalVencido: 0, totalPorVencer: 0, buckets: { CORRIENTE: 0, D1_30: 0, D31_60: 0, D61_90: 0, D90_MAS: 0 } });
    });
  });
});
