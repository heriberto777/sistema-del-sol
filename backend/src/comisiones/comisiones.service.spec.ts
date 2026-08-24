import { ComisionesService } from './comisiones.service';
import { ComisionesRepository } from './comisiones.repository';
import { PrismaService } from '../prisma/prisma.service';

describe('ComisionesService', () => {
  let service: ComisionesService;
  let repository: jest.Mocked<ComisionesRepository>;
  let prisma: { lineaFactura: { findMany: jest.Mock } };

  beforeEach(() => {
    repository = {
      crearVarias: jest.fn().mockResolvedValue(undefined),
      anularPorFactura: jest.fn().mockResolvedValue(undefined),
      listar: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ComisionesRepository>;
    prisma = { lineaFactura: { findMany: jest.fn().mockResolvedValue([]) } };
    service = new ComisionesService(repository, prisma as unknown as PrismaService);
  });

  describe('generarDesdeFactura', () => {
    it('no hace nada si la factura no tiene vendedorEmpleadoId (fuera de POS, ítem F-2)', async () => {
      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'f1', vendedorEmpleadoId: null, tipoFactura: 'CONTADO' });

      expect(prisma.lineaFactura.findMany).not.toHaveBeenCalled();
      expect(repository.crearVarias).not.toHaveBeenCalled();
    });

    it('no genera comisión para NOTA_CREDITO/NOTA_DEBITO (ajustan una venta ya facturada, no son una venta nueva)', async () => {
      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'f1', vendedorEmpleadoId: 'emp-1', tipoFactura: 'NOTA_CREDITO' });

      expect(prisma.lineaFactura.findMany).not.toHaveBeenCalled();
    });

    it('calcula el % de comisión sobre el monto neto (cantidad*precio - descuento), sin ITBIS', async () => {
      prisma.lineaFactura.findMany.mockResolvedValue([
        { id: 'lf1', productoId: 'p1', cantidad: 2, precioUnitario: 100, descuento: 20, producto: { porcentajeComision: 10, montoComisionFijo: null } },
      ]);

      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'f1', vendedorEmpleadoId: 'emp-1', tipoFactura: 'CONTADO' });

      // (2*100 - 20) * 10% = 18
      expect(repository.crearVarias).toHaveBeenCalledWith('t1', [
        { facturaId: 'f1', lineaFacturaId: 'lf1', productoId: 'p1', empleadoId: 'emp-1', monto: 18 },
      ]);
    });

    it('calcula el monto fijo por unidad vendida', async () => {
      prisma.lineaFactura.findMany.mockResolvedValue([
        { id: 'lf1', productoId: 'p1', cantidad: 3, precioUnitario: 100, descuento: 0, producto: { porcentajeComision: null, montoComisionFijo: 15 } },
      ]);

      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'f1', vendedorEmpleadoId: 'emp-1', tipoFactura: 'CREDITO' });

      expect(repository.crearVarias).toHaveBeenCalledWith('t1', [
        { facturaId: 'f1', lineaFacturaId: 'lf1', productoId: 'p1', empleadoId: 'emp-1', monto: 45 },
      ]);
    });

    it('un producto sin porcentajeComision ni montoComisionFijo no genera fila', async () => {
      prisma.lineaFactura.findMany.mockResolvedValue([
        { id: 'lf1', productoId: 'p1', cantidad: 2, precioUnitario: 100, descuento: 0, producto: { porcentajeComision: null, montoComisionFijo: null } },
      ]);

      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'f1', vendedorEmpleadoId: 'emp-1', tipoFactura: 'CONTADO' });

      expect(repository.crearVarias).toHaveBeenCalledWith('t1', []);
    });

    it('filtra en el where las líneas con pagaComision:true — una oferta que no paga comisión (ítem A-2) queda afuera antes de calcular', async () => {
      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'f1', vendedorEmpleadoId: 'emp-1', tipoFactura: 'CONTADO' });

      expect(prisma.lineaFactura.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { facturaId: 'f1', pagaComision: true } }),
      );
    });
  });

  describe('anularPorFactura', () => {
    it('delega en el repositorio (marca anulada:true, nunca borra la fila)', async () => {
      await service.anularPorFactura('t1', 'f1');
      expect(repository.anularPorFactura).toHaveBeenCalledWith('t1', 'f1');
    });
  });

  describe('reportes', () => {
    const filas = [
      {
        facturaId: 'f1',
        empleadoId: 'emp-1',
        productoId: 'p1',
        monto: 18,
        factura: { ncf: 'B0200000001', fecha: new Date('2026-08-01'), cliente: { nombre: 'Cliente A' } },
        empleado: { nombre: 'Juan Vendedor' },
        producto: { codigo: 'P1', nombre: 'Producto Uno' },
      },
      {
        facturaId: 'f1',
        empleadoId: 'emp-1',
        productoId: 'p2',
        monto: 10,
        factura: { ncf: 'B0200000001', fecha: new Date('2026-08-01'), cliente: { nombre: 'Cliente A' } },
        empleado: { nombre: 'Juan Vendedor' },
        producto: { codigo: 'P2', nombre: 'Producto Dos' },
      },
      {
        facturaId: 'f2',
        empleadoId: 'emp-2',
        productoId: 'p1',
        monto: 30,
        factura: { ncf: 'B0200000002', fecha: new Date('2026-08-02'), cliente: { nombre: 'Cliente B' } },
        empleado: { nombre: 'María Vendedora' },
        producto: { codigo: 'P1', nombre: 'Producto Uno' },
      },
    ];

    beforeEach(() => {
      repository.listar.mockResolvedValue(filas as never);
    });

    it('reportePorVenta agrupa por factura, sumando el monto de sus líneas', async () => {
      const { datos } = await service.reportePorVenta();

      expect(datos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ facturaId: 'f1', montoTotal: 28, cantidadLineas: 2, empleado: 'Juan Vendedor' }),
          expect.objectContaining({ facturaId: 'f2', montoTotal: 30, cantidadLineas: 1, empleado: 'María Vendedora' }),
        ]),
      );
    });

    it('reportePorVendedor agrupa por empleado, contando ventas distintas', async () => {
      const { datos } = await service.reportePorVendedor();

      expect(datos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ empleadoId: 'emp-1', montoTotal: 28, cantidadVentas: 1 }),
          expect.objectContaining({ empleadoId: 'emp-2', montoTotal: 30, cantidadVentas: 1 }),
        ]),
      );
    });

    it('reportePorProducto agrupa por producto, sumando entre distintas ventas', async () => {
      const { datos } = await service.reportePorProducto();

      expect(datos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ productoId: 'p1', montoTotal: 48, cantidadLineas: 2 }),
          expect.objectContaining({ productoId: 'p2', montoTotal: 10, cantidadLineas: 1 }),
        ]),
      );
    });
  });
});
