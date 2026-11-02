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
    } as unknown as jest.Mocked<CuentasPorPagarRepository>;
    service = new CuentasPorPagarService(repository);
  });

  describe('listar', () => {
    it('CxP como ledger real (Fase 2): lee saldo/fechaVencimiento directo de CuentaPorPagar, sin recalcular Pago', async () => {
      repository.listar.mockResolvedValue([
        [
          {
            id: 'o1',
            numero: '00010',
            fecha: hace(45),
            proveedor: { nombre: 'Proveedor X' },
            cuentasPorPagar: [{ monto: 1000, saldo: 600, fechaVencimiento: hace(15) }],
          },
        ],
        1,
      ] as never);

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

    it('una orden con varias recepciones abiertas suma sus CuentaPorPagar y usa el vencimiento más antiguo (el más urgente)', async () => {
      repository.listar.mockResolvedValue([
        [
          {
            id: 'o1',
            numero: '00013',
            fecha: hace(50),
            proveedor: { nombre: 'Proveedor W' },
            cuentasPorPagar: [
              { monto: 500, saldo: 500, fechaVencimiento: hace(15) }, // más urgente
              { monto: 300, saldo: 300, fechaVencimiento: hace(5) },
            ],
          },
        ],
        1,
      ] as never);

      const resultado = await service.listar({});

      expect(resultado.datos[0]).toEqual(
        expect.objectContaining({ total: 800, pendiente: 800, diasVencido: 15, bucket: 'D1_30' }),
      );
    });

    it('sin pagos registrados, pendiente es igual al monto', async () => {
      repository.listar.mockResolvedValue([
        [
          {
            id: 'o1',
            numero: '00011',
            fecha: hace(5),
            proveedor: { nombre: 'Proveedor Y' },
            cuentasPorPagar: [{ monto: 500, saldo: 500, fechaVencimiento: hace(-25) }],
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
      expect(resumen.totalCxP).toBe(1600);
      expect(resumen.totalVencido).toBe(1100);
      expect(resumen.totalPorVencer).toBe(500);
    });

    it('sin ninguna CuentaPorPagar pendiente, todo queda en cero', async () => {
      const resumen = await service.resumen();

      expect(resumen).toEqual({ totalCxP: 0, totalVencido: 0, totalPorVencer: 0, buckets: { CORRIENTE: 0, D1_30: 0, D31_60: 0, D61_90: 0, D90_MAS: 0 } });
    });

    it('Fase 5 — una CuentaPorPagar de origen FacturaProveedor (sin ordenCompraId) suma igual que una de Compras: listarTodasPendientes ya es genérico', async () => {
      repository.listarTodasPendientes.mockResolvedValue([
        { id: 'c1', saldo: 500, fechaVencimiento: hace(15) }, // origen OrdenCompra
        { id: 'c2', saldo: 300, fechaVencimiento: hace(5) }, // origen FacturaProveedor — mismo shape, sin distinción
      ] as never);

      const resumen = await service.resumen();

      expect(resumen.totalCxP).toBe(800);
      expect(resumen.totalVencido).toBe(800);
    });
  });
});
