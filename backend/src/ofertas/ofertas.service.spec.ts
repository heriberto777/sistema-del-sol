import { BadRequestException } from '@nestjs/common';
import { OfertasService } from './ofertas.service';
import { OfertasRepository } from './ofertas.repository';

describe('OfertasService', () => {
  let service: OfertasService;
  let repository: jest.Mocked<OfertasRepository>;

  const ofertaBase = (overrides: Record<string, unknown> = {}) => ({
    id: 'oferta-1',
    tipoDescuento: 'PORCENTAJE',
    valor: 10,
    alcance: 'PRODUCTO',
    productoId: 'prod-1',
    categoriaId: null,
    montoMinimoCarrito: null,
    ...overrides,
  });

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      actualizar: jest.fn(),
      eliminar: jest.fn(),
      buscarVigentesParaLinea: jest.fn().mockResolvedValue([]),
      buscarVigentesDeCarrito: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<OfertasRepository>;
    service = new OfertasService(repository);
  });

  describe('crear — validación de alcance', () => {
    it('rechaza fechaFin anterior a fechaInicio', async () => {
      await expect(
        service.crear(
          { nombre: 'x', tipoDescuento: 'PORCENTAJE', valor: 10, alcance: 'PRODUCTO', productoId: 'p1', fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-01-01') } as never,
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('PRODUCTO sin productoId se rechaza', async () => {
      await expect(
        service.crear(
          { nombre: 'x', tipoDescuento: 'PORCENTAJE', valor: 10, alcance: 'PRODUCTO', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-02-01') } as never,
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('PRODUCTO con categoriaId también mandado se rechaza (mutuamente exclusivos)', async () => {
      await expect(
        service.crear(
          {
            nombre: 'x',
            tipoDescuento: 'PORCENTAJE',
            valor: 10,
            alcance: 'PRODUCTO',
            productoId: 'p1',
            categoriaId: 'c1',
            fechaInicio: new Date('2026-01-01'),
            fechaFin: new Date('2026-02-01'),
          } as never,
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('CATEGORIA sin categoriaId se rechaza', async () => {
      await expect(
        service.crear(
          { nombre: 'x', tipoDescuento: 'PORCENTAJE', valor: 10, alcance: 'CATEGORIA', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-02-01') } as never,
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('CARRITO con productoId mandado se rechaza', async () => {
      await expect(
        service.crear(
          {
            nombre: 'x',
            tipoDescuento: 'PORCENTAJE',
            valor: 10,
            alcance: 'CARRITO',
            productoId: 'p1',
            fechaInicio: new Date('2026-01-01'),
            fechaFin: new Date('2026-02-01'),
          } as never,
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('CARRITO sin montoMinimoCarrito es válido (sin mínimo = siempre aplica)', async () => {
      await service.crear(
        { nombre: 'x', tipoDescuento: 'PORCENTAJE', valor: 10, alcance: 'CARRITO', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-02-01') } as never,
        'tenant-1',
      );
      expect(repository.crear).toHaveBeenCalled();
    });
  });

  describe('resolverDescuentoLinea', () => {
    it('sin ofertas vigentes, no hay descuento', async () => {
      const descuento = await service.resolverDescuentoLinea('prod-1', 'cat-1', 2, 100);
      expect(descuento).toBe(0);
    });

    it('aplica el % de una oferta de PRODUCTO sobre cantidad*precioUnitario', async () => {
      repository.buscarVigentesParaLinea.mockResolvedValue([ofertaBase({ tipoDescuento: 'PORCENTAJE', valor: 10 })] as never);

      const descuento = await service.resolverDescuentoLinea('prod-1', null, 2, 100);

      expect(descuento).toBe(20); // 10% de 200
    });

    it('con dos ofertas que matchean la misma línea (producto y categoría), aplica la de MAYOR descuento — nunca se acumulan', async () => {
      repository.buscarVigentesParaLinea.mockResolvedValue([
        ofertaBase({ tipoDescuento: 'PORCENTAJE', valor: 10 }), // 10% de 200 = 20
        ofertaBase({ id: 'oferta-2', alcance: 'CATEGORIA', productoId: null, categoriaId: 'cat-1', tipoDescuento: 'MONTO_FIJO', valor: 50 }),
      ] as never);

      const descuento = await service.resolverDescuentoLinea('prod-1', 'cat-1', 2, 100);

      expect(descuento).toBe(50); // la mayor de las dos, no 20+50
    });

    it('un MONTO_FIJO mayor que la línea se topa al monto de la línea (nunca deja un total negativo)', async () => {
      repository.buscarVigentesParaLinea.mockResolvedValue([ofertaBase({ tipoDescuento: 'MONTO_FIJO', valor: 500 })] as never);

      const descuento = await service.resolverDescuentoLinea('prod-1', null, 1, 100);

      expect(descuento).toBe(100);
    });
  });

  describe('resolverDescuentoCarritoTotal', () => {
    it('sin ofertas de carrito vigentes, no hay descuento', async () => {
      const descuento = await service.resolverDescuentoCarritoTotal(1000);
      expect(descuento).toBe(0);
    });

    it('ignora una oferta de carrito cuyo montoMinimoCarrito no se alcanza', async () => {
      repository.buscarVigentesDeCarrito.mockResolvedValue([
        ofertaBase({ alcance: 'CARRITO', productoId: null, tipoDescuento: 'PORCENTAJE', valor: 10, montoMinimoCarrito: 5000 }),
      ] as never);

      const descuento = await service.resolverDescuentoCarritoTotal(1000);

      expect(descuento).toBe(0);
    });

    it('aplica el % de carrito cuando se supera el mínimo', async () => {
      repository.buscarVigentesDeCarrito.mockResolvedValue([
        ofertaBase({ alcance: 'CARRITO', productoId: null, tipoDescuento: 'PORCENTAJE', valor: 10, montoMinimoCarrito: 500 }),
      ] as never);

      const descuento = await service.resolverDescuentoCarritoTotal(1000);

      expect(descuento).toBe(100);
    });
  });
});
