import { BadRequestException } from '@nestjs/common';
import { RemisionesService } from './remisiones.service';
import { RemisionesRepository } from './remisiones.repository';
import { FacturacionService } from '../facturacion/facturacion.service';
import { VariantesService } from '../variantes/variantes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RemisionesService', () => {
  let service: RemisionesService;
  let repository: jest.Mocked<RemisionesRepository>;
  let facturacionService: jest.Mocked<FacturacionService>;
  let variantesService: jest.Mocked<VariantesService>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      buscarPorId: jest.fn(),
      listar: jest.fn(),
      actualizarEstado: jest.fn(),
      marcarFacturada: jest.fn(),
      actualizar: jest.fn(),
    } as unknown as jest.Mocked<RemisionesRepository>;
    facturacionService = {
      crear: jest.fn(),
    } as unknown as jest.Mocked<FacturacionService>;
    prisma = {
      bodega: { findFirst: jest.fn().mockResolvedValue(null) },
      configuracion: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as jest.Mocked<PrismaService>;
    variantesService = {
      resolverObligatoria: jest.fn().mockResolvedValue('variante-1'),
    } as unknown as jest.Mocked<VariantesService>;
    service = new RemisionesService(repository, facturacionService, variantesService, prisma);
  });

  describe('crear', () => {
    it('crea la remisión sin tocar inventario ni FacturacionService (movimiento ocurre al facturar)', async () => {
      repository.crear.mockResolvedValue({ id: 'r1' } as never);

      await service.crear(
        { clienteId: 'cliente-1', bodegaId: 'bodega-1', numero: 'REM-001', lineas: [{ productoId: 'prod-1', cantidad: 3 }] },
        'tenant-1',
        'vendedor-1',
      );

      expect(repository.crear).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        clienteId: 'cliente-1',
        bodegaId: 'bodega-1',
        vendedorId: 'vendedor-1',
        numero: 'REM-001',
        lineas: [{ productoId: 'prod-1', varianteId: 'variante-1', cantidad: 3 }],
      });
      expect(facturacionService.crear).not.toHaveBeenCalled();
    });
  });

  describe('actualizar', () => {
    const dto = { clienteId: 'cliente-2', bodegaId: 'bodega-2', numero: 'REM-002', lineas: [{ productoId: 'prod-2', cantidad: 5 }] };

    it('reemplaza clienteId/bodegaId/numero/líneas cuando la remisión está en BORRADOR', async () => {
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

  describe('cambiarEstado', () => {
    it('rechaza cambiar el estado de una remisión ya facturada', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'FACTURADA', facturaId: 'f1' } as never);

      await expect(service.cambiarEstado('r1', 'ENTREGADA')).rejects.toThrow(BadRequestException);
    });

    it('rechaza cambiar el estado de una remisión anulada', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'ANULADA', facturaId: null } as never);

      await expect(service.cambiarEstado('r1', 'ENTREGADA')).rejects.toThrow(BadRequestException);
    });

    it('permite marcar como entregada una remisión abierta', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'BORRADOR', facturaId: null } as never);
      repository.actualizarEstado.mockResolvedValue({ id: 'r1', estado: 'ENTREGADA' } as never);

      await service.cambiarEstado('r1', 'ENTREGADA');

      expect(repository.actualizarEstado).toHaveBeenCalledWith('r1', 'ENTREGADA');
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
      );
      expect(repository.marcarFacturada).toHaveBeenCalledWith('r1', 'f1');
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
