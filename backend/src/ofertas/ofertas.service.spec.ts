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
    comprarCantidad: null,
    llevarCantidad: null,
    porcentajeDescuentoLlevar: null,
    descuentoMaximoMonto: null,
    acumulable: false,
    prioridad: 0,
    pagaComision: true,
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

    it('BOGO de alcance CARRITO se rechaza (ítem A-2 — no tiene sentido sobre el total del carrito)', async () => {
      await expect(
        service.crear(
          {
            nombre: 'x',
            tipoDescuento: 'BOGO',
            alcance: 'CARRITO',
            comprarCantidad: 2,
            llevarCantidad: 1,
            fechaInicio: new Date('2026-01-01'),
            fechaFin: new Date('2026-02-01'),
          } as never,
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('BOGO sin comprarCantidad/llevarCantidad se rechaza', async () => {
      await expect(
        service.crear(
          { nombre: 'x', tipoDescuento: 'BOGO', alcance: 'PRODUCTO', productoId: 'p1', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-02-01') } as never,
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('PORCENTAJE/MONTO_FIJO sin valor se rechaza', async () => {
      await expect(
        service.crear(
          { nombre: 'x', tipoDescuento: 'PORCENTAJE', alcance: 'PRODUCTO', productoId: 'p1', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-02-01') } as never,
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('BOGO válido (PRODUCTO, con comprarCantidad/llevarCantidad) se acepta', async () => {
      await service.crear(
        {
          nombre: 'x',
          tipoDescuento: 'BOGO',
          alcance: 'PRODUCTO',
          productoId: 'p1',
          comprarCantidad: 2,
          llevarCantidad: 1,
          fechaInicio: new Date('2026-01-01'),
          fechaFin: new Date('2026-02-01'),
        } as never,
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

    describe('BOGO (ítem A-2)', () => {
      it('"Compra 2 Lleva 1" (100% gratis): 6 unidades = 2 grupos completos = 2 gratis', async () => {
        repository.buscarVigentesParaLinea.mockResolvedValue([
          ofertaBase({ tipoDescuento: 'BOGO', valor: null, comprarCantidad: 2, llevarCantidad: 1, porcentajeDescuentoLlevar: 100 }),
        ] as never);

        const descuento = await service.resolverDescuentoLinea('prod-1', null, 6, 100);

        expect(descuento).toBe(200); // 2 unidades gratis * 100
      });

      it('"Segunda Unidad al 50%": comprarCantidad=1, llevarCantidad=1, 50% — 4 unidades = 2 grupos, 2 al 50%', async () => {
        repository.buscarVigentesParaLinea.mockResolvedValue([
          ofertaBase({ tipoDescuento: 'BOGO', valor: null, comprarCantidad: 1, llevarCantidad: 1, porcentajeDescuentoLlevar: 50 }),
        ] as never);

        const descuento = await service.resolverDescuentoLinea('prod-1', null, 4, 100);

        expect(descuento).toBe(100); // 2 unidades al 50% de 100 c/u = 100
      });

      it('un grupo incompleto no lleva descuento (hay que completar la compra)', async () => {
        repository.buscarVigentesParaLinea.mockResolvedValue([
          ofertaBase({ tipoDescuento: 'BOGO', valor: null, comprarCantidad: 2, llevarCantidad: 1, porcentajeDescuentoLlevar: 100 }),
        ] as never);

        const descuento = await service.resolverDescuentoLinea('prod-1', null, 2, 100); // solo 2, no completa el grupo de 3

        expect(descuento).toBe(0);
      });

      it('porcentajeDescuentoLlevar por defecto (no enviado) es 100% — gratis', async () => {
        repository.buscarVigentesParaLinea.mockResolvedValue([
          ofertaBase({ tipoDescuento: 'BOGO', valor: null, comprarCantidad: 2, llevarCantidad: 1, porcentajeDescuentoLlevar: null }),
        ] as never);

        const descuento = await service.resolverDescuentoLinea('prod-1', null, 3, 100);

        expect(descuento).toBe(100);
      });
    });

    it('descuentoMaximoMonto topa el descuento aunque el % calculado sea mayor', async () => {
      repository.buscarVigentesParaLinea.mockResolvedValue([
        ofertaBase({ tipoDescuento: 'PORCENTAJE', valor: 50, descuentoMaximoMonto: 30 }),
      ] as never);

      const descuento = await service.resolverDescuentoLinea('prod-1', null, 2, 100); // 50% de 200 = 100, pero topado a 30

      expect(descuento).toBe(30);
    });

    describe('acumulabilidad y prioridad (ítem A-2)', () => {
      it('suma varias ofertas acumulables entre sí', async () => {
        repository.buscarVigentesParaLinea.mockResolvedValue([
          ofertaBase({ id: 'o1', tipoDescuento: 'PORCENTAJE', valor: 10, acumulable: true }), // 10% de 200 = 20
          ofertaBase({ id: 'o2', tipoDescuento: 'MONTO_FIJO', valor: 15, acumulable: true }), // 15
        ] as never);

        const descuento = await service.resolverDescuentoLinea('prod-1', null, 2, 100);

        expect(descuento).toBe(35); // 20 + 15, no el máximo de los dos
      });

      it('si la suma de acumulables es menor que la mejor no acumulable, gana la no acumulable', async () => {
        repository.buscarVigentesParaLinea.mockResolvedValue([
          ofertaBase({ id: 'o1', tipoDescuento: 'MONTO_FIJO', valor: 5, acumulable: true }),
          ofertaBase({ id: 'o2', tipoDescuento: 'PORCENTAJE', valor: 50, acumulable: false }), // 50% de 200 = 100
        ] as never);

        const descuento = await service.resolverDescuentoLinea('prod-1', null, 2, 100);

        expect(descuento).toBe(100);
      });

      it('si la suma de acumulables es mayor que la mejor no acumulable, gana la suma', async () => {
        repository.buscarVigentesParaLinea.mockResolvedValue([
          ofertaBase({ id: 'o1', tipoDescuento: 'PORCENTAJE', valor: 30, acumulable: true }), // 60
          ofertaBase({ id: 'o2', tipoDescuento: 'PORCENTAJE', valor: 20, acumulable: true }), // 40
          ofertaBase({ id: 'o3', tipoDescuento: 'MONTO_FIJO', valor: 50, acumulable: false }),
        ] as never);

        const descuento = await service.resolverDescuentoLinea('prod-1', null, 2, 100);

        expect(descuento).toBe(100); // 60+40, mayor que la no acumulable de 50
      });
    });
  });

  describe('resolverDescuentoLineaConComision (ítem A-1)', () => {
    it('sin ofertas vigentes, paga comisión normal', async () => {
      const resultado = await service.resolverDescuentoLineaConComision('prod-1', null, 2, 100);
      expect(resultado).toEqual({ monto: 0, pagaComision: true });
    });

    it('oferta única con pagaComision:false — la línea no paga comisión', async () => {
      repository.buscarVigentesParaLinea.mockResolvedValue([
        ofertaBase({ tipoDescuento: 'PORCENTAJE', valor: 10, pagaComision: false }),
      ] as never);

      const resultado = await service.resolverDescuentoLineaConComision('prod-1', null, 2, 100);

      expect(resultado).toEqual({ monto: 20, pagaComision: false });
    });

    it('oferta única con pagaComision:true — la línea sí paga comisión', async () => {
      repository.buscarVigentesParaLinea.mockResolvedValue([ofertaBase({ tipoDescuento: 'PORCENTAJE', valor: 10 })] as never);

      const resultado = await service.resolverDescuentoLineaConComision('prod-1', null, 2, 100);

      expect(resultado).toEqual({ monto: 20, pagaComision: true });
    });

    it('acumulables: si CUALQUIERA de las que efectivamente aportó descuento no paga comisión, la línea entera queda sin comisión', async () => {
      repository.buscarVigentesParaLinea.mockResolvedValue([
        ofertaBase({ id: 'o1', tipoDescuento: 'PORCENTAJE', valor: 10, acumulable: true, pagaComision: true }),
        ofertaBase({ id: 'o2', tipoDescuento: 'MONTO_FIJO', valor: 15, acumulable: true, pagaComision: false }),
      ] as never);

      const resultado = await service.resolverDescuentoLineaConComision('prod-1', null, 2, 100);

      expect(resultado).toEqual({ monto: 35, pagaComision: false });
    });

    it('acumulables, todas pagan comisión — la línea paga comisión', async () => {
      repository.buscarVigentesParaLinea.mockResolvedValue([
        ofertaBase({ id: 'o1', tipoDescuento: 'PORCENTAJE', valor: 10, acumulable: true, pagaComision: true }),
        ofertaBase({ id: 'o2', tipoDescuento: 'MONTO_FIJO', valor: 15, acumulable: true, pagaComision: true }),
      ] as never);

      const resultado = await service.resolverDescuentoLineaConComision('prod-1', null, 2, 100);

      expect(resultado).toEqual({ monto: 35, pagaComision: true });
    });

    it('no acumulables: gana la mejor, y su propio pagaComision es el que decide (no el de la que perdió)', async () => {
      repository.buscarVigentesParaLinea.mockResolvedValue([
        ofertaBase({ id: 'o1', tipoDescuento: 'PORCENTAJE', valor: 10, pagaComision: false }), // 20, pierde
        ofertaBase({ id: 'o2', tipoDescuento: 'MONTO_FIJO', valor: 50, pagaComision: true }), // 50, gana
      ] as never);

      const resultado = await service.resolverDescuentoLineaConComision('prod-1', null, 2, 100);

      expect(resultado).toEqual({ monto: 50, pagaComision: true });
    });
  });

  describe('resolverOfertaVisibleProducto (Fase 13 — insignia/precio en la tarjeta)', () => {
    it('sin ofertas vigentes, no hay nada que mostrar', async () => {
      const resultado = await service.resolverOfertaVisibleProducto('prod-1', 'cat-1', 100);
      expect(resultado).toBeNull();
    });

    it('PORCENTAJE — devuelve precio con descuento, ahorro y porcentaje, usando la MISMA fórmula que la venta', async () => {
      repository.buscarVigentesParaLinea.mockResolvedValue([ofertaBase({ tipoDescuento: 'PORCENTAJE', valor: 20 })] as never);

      const resultado = await service.resolverOfertaVisibleProducto('prod-1', null, 250);

      expect(resultado).toEqual({ tipo: 'DESCUENTO', precioConDescuento: 200, ahorro: 50, porcentaje: 20 });
    });

    it('MONTO_FIJO — topado a la propia base si el descuento es mayor al precio', async () => {
      repository.buscarVigentesParaLinea.mockResolvedValue([ofertaBase({ tipoDescuento: 'MONTO_FIJO', valor: 500 })] as never);

      const resultado = await service.resolverOfertaVisibleProducto('prod-1', null, 100);

      expect(resultado).toEqual({ tipo: 'DESCUENTO', precioConDescuento: 0, ahorro: 100, porcentaje: 100 });
    });

    it('BOGO — a cantidad=1 no da descuento de precio, se muestra como mecánica (insignia), nunca como precio tachado inventado', async () => {
      repository.buscarVigentesParaLinea.mockResolvedValue([
        ofertaBase({ tipoDescuento: 'BOGO', valor: null, comprarCantidad: 2, llevarCantidad: 1, porcentajeDescuentoLlevar: 100 }),
      ] as never);

      const resultado = await service.resolverOfertaVisibleProducto('prod-1', null, 100);

      expect(resultado).toEqual({ tipo: 'BOGO', comprarCantidad: 2, llevarCantidad: 1, porcentajeDescuentoLlevar: 100 });
    });

    it('con PRODUCTO y CATEGORIA vigentes a la vez, gana la de mayor descuento (mismo criterio que resolverDescuentoLinea)', async () => {
      repository.buscarVigentesParaLinea.mockResolvedValue([
        ofertaBase({ tipoDescuento: 'PORCENTAJE', valor: 10 }), // 10% de 100 = 10
        ofertaBase({ id: 'oferta-2', alcance: 'CATEGORIA', productoId: null, categoriaId: 'cat-1', tipoDescuento: 'MONTO_FIJO', valor: 40 }),
      ] as never);

      const resultado = await service.resolverOfertaVisibleProducto('prod-1', 'cat-1', 100);

      expect(resultado).toEqual({ tipo: 'DESCUENTO', precioConDescuento: 60, ahorro: 40, porcentaje: 40 });
    });

    it('precio <= 0 no consulta nada y devuelve null', async () => {
      const resultado = await service.resolverOfertaVisibleProducto('prod-1', null, 0);
      expect(resultado).toBeNull();
      expect(repository.buscarVigentesParaLinea).not.toHaveBeenCalled();
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
