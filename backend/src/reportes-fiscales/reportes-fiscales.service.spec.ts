import { ReportesFiscalesService } from './reportes-fiscales.service';
import { ReportesFiscalesRepository } from './reportes-fiscales.repository';

describe('ReportesFiscalesService', () => {
  let service: ReportesFiscalesService;
  let repository: jest.Mocked<ReportesFiscalesRepository>;

  beforeEach(() => {
    repository = {
      ventasEnRango: jest.fn(),
      anuladasEnRango: jest.fn(),
      comprasRecibidasEnRango: jest.fn(),
      gastosMenoresEnRango: jest.fn().mockResolvedValue([]),
      retencionesNominaEnRango: jest.fn(),
      retencionesProveedoresEnRango: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ReportesFiscalesRepository>;
    service = new ReportesFiscalesService(repository);
  });

  describe('formato607 (ventas)', () => {
    it('mapea RNC, NCF, fecha y montos de cada factura', async () => {
      repository.ventasEnRango.mockResolvedValue([
        { ncf: 'B0200000001', fecha: new Date('2026-01-05'), subtotal: 100, itbis: 18, total: 118, cliente: { rncCedula: '13100000001' } },
      ] as never);

      const { filas, resumen } = await service.formato607();

      expect(filas[0]).toEqual(
        expect.objectContaining({ rncCedula: '13100000001', ncf: 'B0200000001', montoFacturado: 100, itbisFacturado: 18 }),
      );
      expect(resumen).toEqual({ cantidad: 1, montoFacturado: 100, itbisFacturado: 18 });
    });

    it('usa cadena vacía si el cliente no tiene RNC/cédula registrado', async () => {
      repository.ventasEnRango.mockResolvedValue([
        { ncf: 'B0200000002', fecha: new Date('2026-01-05'), subtotal: 100, itbis: 18, total: 118, cliente: { rncCedula: null } },
      ] as never);

      const { filas } = await service.formato607();

      expect(filas[0].rncCedula).toBe('');
    });
  });

  describe('exportar607Txt', () => {
    it('genera un TXT delimitado por | con fecha en AAAAMMDD', async () => {
      repository.ventasEnRango.mockResolvedValue([
        { ncf: 'B0200000001', fecha: new Date(2026, 0, 5), subtotal: 100, itbis: 18, total: 118, cliente: { rncCedula: '13100000001' } },
      ] as never);

      const txt = await service.exportar607Txt();

      expect(txt).toBe('13100000001|B0200000001|20260105|01|100.00|18.00');
    });
  });

  describe('formato608 (anulados)', () => {
    it('mapea NCF y fecha de cada factura anulada', async () => {
      repository.anuladasEnRango.mockResolvedValue([{ ncf: 'B0200000003', fecha: new Date('2026-01-10') }] as never);

      const { filas, resumen } = await service.formato608();

      expect(filas).toEqual([{ ncf: 'B0200000003', fecha: new Date('2026-01-10'), tipoAnulacion: '01' }]);
      expect(resumen).toEqual({ cantidad: 1 });
    });
  });

  describe('formato606 (compras)', () => {
    it('calcula monto e ITBIS por línea usando el porcentajeItbis del producto', async () => {
      repository.comprasRecibidasEnRango.mockResolvedValue([
        {
          fecha: new Date('2026-01-05'),
          facturaProveedorNumero: 'FACT-001',
          ordenCompra: { proveedor: { rnc: '13100000099' } },
          lineas: [
            { costoUnitario: 100, cantidadRecibida: 2, producto: { porcentajeItbis: 18 } },
          ],
        },
      ] as never);

      const { filas, resumen } = await service.formato606();

      // 100 * 2 = 200 monto; itbis 18% = 36
      expect(filas[0]).toEqual(
        expect.objectContaining({ rncProveedor: '13100000099', numeroComprobante: 'FACT-001', montoFacturado: 200, itbisFacturado: 36 }),
      );
      expect(resumen).toEqual({ cantidad: 1, montoFacturado: 200, itbisFacturado: 36 });
    });

    it('suma varias líneas de la misma recepción', async () => {
      repository.comprasRecibidasEnRango.mockResolvedValue([
        {
          fecha: new Date('2026-01-05'),
          facturaProveedorNumero: 'FACT-002',
          ordenCompra: { proveedor: { rnc: null } },
          lineas: [
            { costoUnitario: 50, cantidadRecibida: 1, producto: { porcentajeItbis: 18 } },
            { costoUnitario: 30, cantidadRecibida: 2, producto: { porcentajeItbis: 0 } },
          ],
        },
      ] as never);

      const { filas } = await service.formato606();

      // linea 1: 50*1=50, itbis 9; linea 2: 30*2=60, itbis 0 => total monto 110, itbis 9
      expect(filas[0].montoFacturado).toBe(110);
      expect(filas[0].itbisFacturado).toBe(9);
      expect(filas[0].rncProveedor).toBe('');
    });

    it('incluye los gastos menores (NCF B11/E43, mercado informal) junto a las compras formales', async () => {
      repository.comprasRecibidasEnRango.mockResolvedValue([
        { fecha: new Date('2026-01-10'), facturaProveedorNumero: 'FACT-003', ordenCompra: { proveedor: { rnc: '13100000001' } }, lineas: [] },
      ] as never);
      repository.gastosMenoresEnRango.mockResolvedValue([
        { fecha: new Date('2026-01-05'), ncf: 'B1100000001', monto: 500, itbis: 90 },
      ] as never);

      const { filas, resumen } = await service.formato606();

      expect(filas).toHaveLength(2);
      expect(filas.find((f) => f.numeroComprobante === 'B1100000001')).toEqual(
        expect.objectContaining({ rncProveedor: '', montoFacturado: 500, itbisFacturado: 90 }),
      );
      expect(resumen).toEqual({ cantidad: 2, montoFacturado: 500, itbisFacturado: 90 });
    });
  });

  describe('resumenItbis', () => {
    it('calcula el neto como ventas menos compras', async () => {
      repository.ventasEnRango.mockResolvedValue([
        { ncf: 'B01', fecha: new Date(), subtotal: 1000, itbis: 180, total: 1180, cliente: { rncCedula: null } },
      ] as never);
      repository.comprasRecibidasEnRango.mockResolvedValue([
        {
          fecha: new Date(),
          facturaProveedorNumero: 'F1',
          ordenCompra: { proveedor: { rnc: null } },
          lineas: [{ costoUnitario: 500, cantidadRecibida: 1, producto: { porcentajeItbis: 18 } }],
        },
      ] as never);

      const resultado = await service.resumenItbis();

      expect(resultado.itbisEnVentas).toBe(180);
      expect(resultado.itbisEnCompras).toBe(90);
      expect(resultado.itbisNetoAPagar).toBe(90);
    });
  });

  describe('formatoIT1', () => {
    it('clasifica el neto positivo como ITBIS a pagar', async () => {
      repository.ventasEnRango.mockResolvedValue([
        { ncf: 'B01', fecha: new Date(), subtotal: 1000, itbis: 180, total: 1180, cliente: { rncCedula: null } },
      ] as never);
      repository.comprasRecibidasEnRango.mockResolvedValue([]);

      const resultado = await service.formatoIT1();

      expect(resultado.itbisEnVentas).toBe(180);
      expect(resultado.itbisAPagar).toBe(180);
      expect(resultado.itbisSaldoAFavor).toBe(0);
    });

    it('clasifica el neto negativo como saldo a favor', async () => {
      repository.ventasEnRango.mockResolvedValue([]);
      repository.comprasRecibidasEnRango.mockResolvedValue([
        {
          fecha: new Date(),
          facturaProveedorNumero: 'F1',
          ordenCompra: { proveedor: { rnc: null } },
          lineas: [{ costoUnitario: 500, cantidadRecibida: 1, producto: { porcentajeItbis: 18 } }],
        },
      ] as never);

      const resultado = await service.formatoIT1();

      expect(resultado.itbisAPagar).toBe(0);
      expect(resultado.itbisSaldoAFavor).toBe(90);
    });
  });

  describe('retencionesNomina', () => {
    it('agrupa el ISR y el salario bruto por empleado a través de varios recibos', async () => {
      repository.retencionesNominaEnRango.mockResolvedValue([
        { empleadoId: 'e1', salarioBruto: 30000, isr: 500, empleado: { cedula: '001-1', nombre: 'Ana Pérez' } },
        { empleadoId: 'e1', salarioBruto: 30000, isr: 500, empleado: { cedula: '001-1', nombre: 'Ana Pérez' } },
        { empleadoId: 'e2', salarioBruto: 20000, isr: 0, empleado: { cedula: '002-2', nombre: 'Beto Ruiz' } },
      ] as never);

      const resultado = await service.retencionesNomina('tenant-1');

      expect(repository.retencionesNominaEnRango).toHaveBeenCalledWith('tenant-1', expect.any(Date), expect.any(Date));
      expect(resultado.empleados).toEqual([
        { cedula: '001-1', nombre: 'Ana Pérez', salarioBruto: 60000, isr: 1000 },
        { cedula: '002-2', nombre: 'Beto Ruiz', salarioBruto: 20000, isr: 0 },
      ]);
      expect(resultado.resumen).toEqual({ salarioBruto: 80000, isr: 1000 });
    });
  });

  describe('retencionesProveedores', () => {
    it('mapea proveedor, montos brutos, retenciones y neto pagado', async () => {
      repository.retencionesProveedoresEnRango.mockResolvedValue([
        {
          fecha: new Date('2026-08-10'),
          monto: 1000,
          retencionIsr: 150,
          retencionItbis: 300,
          ordenCompra: { proveedor: { nombre: 'Juan Pérez', rnc: '00112223334' } },
        },
      ] as never);

      const { filas, resumen } = await service.retencionesProveedores();

      expect(filas).toEqual([
        {
          proveedorNombre: 'Juan Pérez',
          proveedorRnc: '00112223334',
          fecha: new Date('2026-08-10'),
          montoBruto: 1000,
          retencionIsr: 150,
          retencionItbis: 300,
          netoPagado: 550,
        },
      ]);
      expect(resumen).toEqual({ cantidad: 1, montoBruto: 1000, retencionIsr: 150, retencionItbis: 300, netoPagado: 550 });
    });

    it('devuelve resumen en cero si no hay pagos con retención en el rango', async () => {
      repository.retencionesProveedoresEnRango.mockResolvedValue([]);

      const { filas, resumen } = await service.retencionesProveedores();

      expect(filas).toEqual([]);
      expect(resumen).toEqual({ cantidad: 0, montoBruto: 0, retencionIsr: 0, retencionItbis: 0, netoPagado: 0 });
    });
  });
});
