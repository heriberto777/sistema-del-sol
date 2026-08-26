import { BadRequestException } from '@nestjs/common';
import { RemisionesService } from './remisiones.service';
import { RemisionesRepository } from './remisiones.repository';
import { FacturacionService } from '../facturacion/facturacion.service';
import { VariantesService } from '../variantes/variantes.service';
import { InventarioService } from '../inventario/inventario.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CorrelativosRepository } from '../correlativos/correlativos.repository';

describe('RemisionesService', () => {
  let service: RemisionesService;
  let repository: jest.Mocked<RemisionesRepository>;
  let facturacionService: jest.Mocked<FacturacionService>;
  let variantesService: jest.Mocked<VariantesService>;
  let inventarioService: jest.Mocked<InventarioService>;
  let correlativosRepository: jest.Mocked<CorrelativosRepository>;
  let prisma: jest.Mocked<PrismaService>;
  let tenantPrisma: { client: { $transaction: jest.Mock } };

  // Ver el mismo patrón en compras.service.spec.ts/facturacion.service.spec.ts.
  const TX = { esTransaccion: true };

  // Línea con el include profundo real (INCLUDE_REMISION) — producto.tipo/
  // componentes, necesarios para expandirParaInventario.
  function lineaRemision(overrides: Record<string, unknown> = {}) {
    return {
      productoId: 'prod-1',
      varianteId: 'variante-1',
      cantidad: 3,
      producto: { tipo: 'PRODUCTO', componentes: [] },
      ...overrides,
    };
  }

  beforeEach(() => {
    repository = {
      crearEnTx: jest.fn(),
      buscarPorId: jest.fn(),
      listar: jest.fn(),
      actualizarEstado: jest.fn(),
      actualizarEstadoEnTx: jest.fn(),
      marcarFacturada: jest.fn(),
      actualizar: jest.fn(),
    } as unknown as jest.Mocked<RemisionesRepository>;
    facturacionService = {
      crear: jest.fn(),
    } as unknown as jest.Mocked<FacturacionService>;
    prisma = {
      bodega: { findFirst: jest.fn().mockResolvedValue(null) },
      configuracion: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as jest.Mocked<PrismaService>;
    variantesService = {
      resolverObligatoria: jest.fn().mockResolvedValue('variante-1'),
    } as unknown as jest.Mocked<VariantesService>;
    inventarioService = {
      verificarYDescontarStockEnTx: jest.fn().mockResolvedValue(undefined),
      entradaStockEnTx: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<InventarioService>;
    correlativosRepository = { siguienteEnTx: jest.fn().mockResolvedValue('REM-00001') } as unknown as jest.Mocked<CorrelativosRepository>;
    tenantPrisma = { client: { $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(TX)) } };
    service = new RemisionesService(
      repository,
      facturacionService,
      variantesService,
      inventarioService,
      correlativosRepository,
      prisma,
      tenantPrisma as unknown as TenantPrismaService,
    );
  });

  describe('crear', () => {
    it('crea la remisión en BORRADOR sin tocar inventario ni FacturacionService (el movimiento ocurre recién al marcar entregada o al facturar)', async () => {
      repository.crearEnTx.mockResolvedValue({ id: 'r1' } as never);

      await service.crear(
        { clienteId: 'cliente-1', bodegaId: 'bodega-1', lineas: [{ productoId: 'prod-1', cantidad: 3 }] },
        'tenant-1',
        'vendedor-1',
      );

      expect(correlativosRepository.siguienteEnTx).toHaveBeenCalledWith(TX, 'tenant-1', 'REMISION');
      expect(repository.crearEnTx).toHaveBeenCalledWith(TX, {
        tenantId: 'tenant-1',
        clienteId: 'cliente-1',
        bodegaId: 'bodega-1',
        vendedorId: 'vendedor-1',
        numero: 'REM-00001',
        lineas: [{ productoId: 'prod-1', varianteId: 'variante-1', cantidad: 3 }],
      });
      expect(facturacionService.crear).not.toHaveBeenCalled();
    });
  });

  describe('actualizar', () => {
    const dto = { clienteId: 'cliente-2', bodegaId: 'bodega-2', lineas: [{ productoId: 'prod-2', cantidad: 5 }] };

    it('reemplaza clienteId/bodegaId/líneas cuando la remisión está en BORRADOR (el número no se toca)', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'r1', estado: 'BORRADOR', facturaId: null } as never);
      repository.actualizar.mockResolvedValue({ id: 'r1' } as never);

      await service.actualizar('r1', dto);

      expect(repository.actualizar).toHaveBeenCalledWith('r1', {
        ...dto,
        lineas: [{ productoId: 'prod-2', varianteId: 'variante-1', cantidad: 5 }],
      });
    });

    it('rechaza editar una remisión ya entregada', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'r1', estado: 'ENTREGADA', facturaId: null } as never);

      await expect(service.actualizar('r1', dto)).rejects.toThrow(BadRequestException);
      expect(repository.actualizar).not.toHaveBeenCalled();
    });
  });

  describe('cambiarEstado ("Remisión + stock")', () => {
    it('rechaza cambiar el estado de una remisión ya facturada', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'FACTURADA', facturaId: 'f1' } as never);

      await expect(service.cambiarEstado('r1', 'ENTREGADA', 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('rechaza cambiar el estado de una remisión anulada', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'ANULADA', facturaId: null } as never);

      await expect(service.cambiarEstado('r1', 'ENTREGADA', 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('rechaza marcar entregada una remisión que no está en BORRADOR (evita descontar dos veces)', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'ENTREGADA', facturaId: null } as never);

      await expect(service.cambiarEstado('r1', 'ENTREGADA', 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
      expect(inventarioService.verificarYDescontarStockEnTx).not.toHaveBeenCalled();
    });

    it('BORRADOR → ENTREGADA descuenta stock de verdad (referenciaTipo REMISION)', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'r1',
        estado: 'BORRADOR',
        facturaId: null,
        numero: 'REM-001',
        bodegaId: 'bodega-1',
        lineas: [lineaRemision({ cantidad: 3 })],
      } as never);
      repository.actualizarEstadoEnTx.mockResolvedValue({ id: 'r1', estado: 'ENTREGADA' } as never);

      await service.cambiarEstado('r1', 'ENTREGADA', 'tenant-1', 'user-1');

      expect(inventarioService.verificarYDescontarStockEnTx).toHaveBeenCalledWith(TX, {
        tenantId: 'tenant-1',
        productoId: 'prod-1',
        varianteId: 'variante-1',
        bodegaId: 'bodega-1',
        cantidad: 3,
        userId: 'user-1',
        referencia: 'Remisión REM-001',
        referenciaTipo: 'REMISION',
        referenciaId: 'r1',
      });
      expect(repository.actualizarEstadoEnTx).toHaveBeenCalledWith(TX, 'r1', 'ENTREGADA');
    });

    it('BORRADOR → ENTREGADA expande un COMBO a sus componentes físicos', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'r1',
        estado: 'BORRADOR',
        facturaId: null,
        numero: 'REM-001',
        bodegaId: 'bodega-1',
        lineas: [
          lineaRemision({
            productoId: 'combo-1',
            cantidad: 2,
            producto: { tipo: 'COMBO', componentes: [{ cantidad: 3, componente: { id: 'comp-1', tipo: 'PRODUCTO' } }] },
          }),
        ],
      } as never);

      await service.cambiarEstado('r1', 'ENTREGADA', 'tenant-1', 'user-1');

      expect(inventarioService.verificarYDescontarStockEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ productoId: 'comp-1', cantidad: 6 }), // 2 combos * 3 por componente
      );
    });

    it('BORRADOR → ANULADA nunca movió stock, no reintegra nada', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'r1',
        estado: 'BORRADOR',
        facturaId: null,
        numero: 'REM-001',
        bodegaId: 'bodega-1',
        lineas: [lineaRemision()],
      } as never);

      await service.cambiarEstado('r1', 'ANULADA', 'tenant-1', 'user-1');

      expect(inventarioService.entradaStockEnTx).not.toHaveBeenCalled();
      expect(repository.actualizarEstadoEnTx).toHaveBeenCalledWith(TX, 'r1', 'ANULADA');
    });

    it('ENTREGADA → ANULADA reintegra el stock ya descontado al entregar', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'r1',
        estado: 'ENTREGADA',
        facturaId: null,
        numero: 'REM-001',
        bodegaId: 'bodega-1',
        lineas: [lineaRemision({ cantidad: 3 })],
      } as never);

      await service.cambiarEstado('r1', 'ANULADA', 'tenant-1', 'user-1');

      expect(inventarioService.entradaStockEnTx).toHaveBeenCalledWith(TX, {
        tenantId: 'tenant-1',
        productoId: 'prod-1',
        varianteId: 'variante-1',
        bodegaId: 'bodega-1',
        cantidad: 3,
        userId: 'user-1',
        motivo: 'Anulación de remisión REM-001',
      });
      expect(inventarioService.verificarYDescontarStockEnTx).not.toHaveBeenCalled();
    });
  });

  describe('convertirEnFactura', () => {
    it('crea la factura con las líneas de la remisión (sin precioUnitario, se resuelve al vigente) y la marca facturada', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'r1',
        estado: 'ENTREGADA',
        facturaId: null,
        clienteId: 'cliente-1',
        bodegaId: 'bodega-1',
        lineas: [{ productoId: 'prod-1', cantidad: 3 }],
      } as never);
      facturacionService.crear.mockResolvedValue({ id: 'f1', total: 300 } as never);

      await service.convertirEnFactura('r1', { tipoFactura: 'CREDITO' }, 'tenant-1', 'vendedor-1');

      expect(facturacionService.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          clienteId: 'cliente-1',
          bodegaId: 'bodega-1',
          tipoFactura: 'CREDITO',
          lineas: [{ productoId: 'prod-1', cantidad: 3 }],
        }),
        'tenant-1',
        'vendedor-1',
        { sinMovimientoInventario: true },
      );
      expect(repository.marcarFacturada).toHaveBeenCalledWith('r1', 'f1');
    });

    it('"Remisión + stock": si nunca pasó por ENTREGADA (convierte directo desde BORRADOR), crear() SÍ mueve stock — cero cambio de comportamiento', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'r1',
        estado: 'BORRADOR',
        facturaId: null,
        clienteId: 'cliente-1',
        bodegaId: 'bodega-1',
        lineas: [{ productoId: 'prod-1', cantidad: 3 }],
      } as never);
      facturacionService.crear.mockResolvedValue({ id: 'f1', total: 300 } as never);

      await service.convertirEnFactura('r1', { tipoFactura: 'CONTADO' }, 'tenant-1', 'vendedor-1');

      expect(facturacionService.crear).toHaveBeenCalledWith(expect.anything(), 'tenant-1', 'vendedor-1', { sinMovimientoInventario: false });
    });

    it('rechaza convertir una remisión ya convertida', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'FACTURADA', facturaId: 'f-existente' } as never);

      await expect(
        service.convertirEnFactura('r1', { tipoFactura: 'CONTADO' }, 'tenant-1', 'vendedor-1'),
      ).rejects.toThrow(BadRequestException);
      expect(facturacionService.crear).not.toHaveBeenCalled();
    });

    it('rechaza convertir una remisión anulada', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'ANULADA', facturaId: null } as never);

      await expect(
        service.convertirEnFactura('r1', { tipoFactura: 'CONTADO' }, 'tenant-1', 'vendedor-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('generarPdf', () => {
    it('genera un PDF a partir de la remisión y sus líneas, sin precios', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'r1',
        numero: 'REM-001',
        fecha: new Date('2026-01-15'),
        cliente: { nombre: 'Cliente Demo' },
        lineas: [{ producto: { nombre: 'Producto A' }, cantidad: 2 }],
      } as never);

      const buffer = await service.generarPdf('r1');

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });
  });
});
