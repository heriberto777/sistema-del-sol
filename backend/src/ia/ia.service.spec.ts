import { IaService } from './ia.service';
import { IaClientService } from './ia-client.service';
import { ReportesService } from '../reportes/reportes.service';
import { CuentasContablesService } from '../contabilidad/cuentas-contables.service';

describe('IaService', () => {
  let service: IaService;
  let iaClient: jest.Mocked<IaClientService>;
  let reportesService: jest.Mocked<ReportesService>;
  let cuentasContablesService: jest.Mocked<CuentasContablesService>;

  beforeEach(() => {
    iaClient = { completar: jest.fn(), habilitado: false } as unknown as jest.Mocked<IaClientService>;
    reportesService = { dashboard: jest.fn() } as unknown as jest.Mocked<ReportesService>;
    cuentasContablesService = { listar: jest.fn() } as unknown as jest.Mocked<CuentasContablesService>;
    service = new IaService(iaClient, reportesService, cuentasContablesService);
  });

  describe('preguntarAsistente', () => {
    it('sin IA habilitada, devuelve el resumen numérico crudo (modo básico)', async () => {
      reportesService.dashboard.mockResolvedValue({ ventasHoyTotal: 5000, facturasHoyCantidad: 3, productosStockBajo: 2, ordenesCompraPendientes: 1, alertasInventario: { sinStock: 0, stockBajo: 2, porVencer7Dias: 0, vencidos: 0 } });

      const resultado = await service.preguntarAsistente('¿cómo van las ventas?', 't1');

      expect(resultado.generadaConIa).toBe(false);
      expect(resultado.respuesta).toContain('5000');
      expect(iaClient.completar).not.toHaveBeenCalled();
    });

    it('con IA habilitada, usa la respuesta generada', async () => {
      Object.defineProperty(iaClient, 'habilitado', { value: true });
      reportesService.dashboard.mockResolvedValue({ ventasHoyTotal: 5000, facturasHoyCantidad: 3, productosStockBajo: 2, ordenesCompraPendientes: 1, alertasInventario: { sinStock: 0, stockBajo: 2, porVencer7Dias: 0, vencidos: 0 } });
      iaClient.completar.mockResolvedValue('Las ventas van bien hoy.');

      const resultado = await service.preguntarAsistente('¿cómo van las ventas?', 't1');

      expect(resultado).toEqual({ respuesta: 'Las ventas van bien hoy.', generadaConIa: true });
    });

    it('con IA habilitada pero que falla la llamada, cae al resumen crudo', async () => {
      Object.defineProperty(iaClient, 'habilitado', { value: true });
      reportesService.dashboard.mockResolvedValue({ ventasHoyTotal: 5000, facturasHoyCantidad: 3, productosStockBajo: 2, ordenesCompraPendientes: 1, alertasInventario: { sinStock: 0, stockBajo: 2, porVencer7Dias: 0, vencidos: 0 } });
      iaClient.completar.mockResolvedValue(null);

      const resultado = await service.preguntarAsistente('¿cómo van las ventas?', 't1');

      expect(resultado.generadaConIa).toBe(false);
    });
  });

  describe('sugerirCuentaContable', () => {
    const cuentas = [
      { codigo: '5020', nombre: 'Gastos Operativos', tipo: 'GASTO', naturaleza: 'DEUDORA' },
      { codigo: '1030', nombre: 'Inventario', tipo: 'ACTIVO', naturaleza: 'DEUDORA' },
      { codigo: '4010', nombre: 'Ingresos por Ventas', tipo: 'INGRESO', naturaleza: 'ACREEDORA' },
    ];

    it('sin IA habilitada, sugiere por coincidencia de palabras entre el concepto y el nombre de la cuenta', async () => {
      cuentasContablesService.listar.mockResolvedValue(cuentas as never);

      const resultado = await service.sugerirCuentaContable('gastos operativos varios de oficina');

      expect(resultado).toEqual({ codigo: '5020', nombre: 'Gastos Operativos', fuente: 'HEURISTICA' });
    });

    it('sin ninguna coincidencia, devuelve null (no inventa una cuenta)', async () => {
      cuentasContablesService.listar.mockResolvedValue(cuentas as never);

      const resultado = await service.sugerirCuentaContable('xyz completamente irrelevante');

      expect(resultado).toBeNull();
    });

    it('nunca sugiere una cuenta de tipo INGRESO (solo GASTO/ACTIVO)', async () => {
      cuentasContablesService.listar.mockResolvedValue(cuentas as never);

      const resultado = await service.sugerirCuentaContable('ingresos por ventas del mes');

      expect(resultado).toBeNull();
    });

    it('con IA habilitada, usa el código que devuelve el modelo si existe en el catálogo', async () => {
      Object.defineProperty(iaClient, 'habilitado', { value: true });
      cuentasContablesService.listar.mockResolvedValue(cuentas as never);
      iaClient.completar.mockResolvedValue('5020');

      const resultado = await service.sugerirCuentaContable('papel higiénico para el baño');

      expect(resultado).toEqual({ codigo: '5020', nombre: 'Gastos Operativos', fuente: 'IA' });
    });
  });

  describe('generarDescripcionProducto', () => {
    it('sin IA habilitada, devuelve una descripción básica sin generar', async () => {
      const resultado = await service.generarDescripcionProducto('Silla ergonómica', 'Mobiliario');

      expect(resultado.generadaConIa).toBe(false);
      expect(resultado.descripcion).toContain('Silla ergonómica');
    });

    it('con IA habilitada, usa el texto generado', async () => {
      Object.defineProperty(iaClient, 'habilitado', { value: true });
      iaClient.completar.mockResolvedValue('Una silla cómoda para tu oficina.');

      const resultado = await service.generarDescripcionProducto('Silla ergonómica');

      expect(resultado).toEqual({ descripcion: 'Una silla cómoda para tu oficina.', generadaConIa: true });
    });
  });
});
