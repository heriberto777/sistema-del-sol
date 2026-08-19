import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VariantesService } from './variantes.service';
import { VariantesRepository } from './variantes.repository';
import { AtributosRepository } from '../atributos/atributos.repository';

describe('VariantesService', () => {
  let service: VariantesService;
  let variantesRepository: jest.Mocked<VariantesRepository>;
  let atributosRepository: jest.Mocked<AtributosRepository>;

  beforeEach(() => {
    variantesRepository = {
      listarPorProducto: jest.fn().mockResolvedValue([]),
      listarIdsPorProducto: jest.fn().mockResolvedValue([{ id: 'v-unica' }]),
      contarMovimientos: jest.fn().mockResolvedValue(0),
      contarUsoEnLineas: jest.fn().mockResolvedValue(0),
      regenerar: jest.fn().mockResolvedValue([{ id: 'v1' }]),
      actualizarCodigoBarras: jest.fn(),
    } as unknown as jest.Mocked<VariantesRepository>;
    atributosRepository = {
      buscarPorId: jest.fn(),
    } as unknown as jest.Mocked<AtributosRepository>;
    service = new VariantesService(variantesRepository, atributosRepository);
  });

  it('sin atributos (seleccion vacía) genera una única variante "por defecto"', async () => {
    await service.generarCombinaciones('p1', 't1', []);

    expect(variantesRepository.regenerar).toHaveBeenCalledWith('p1', 't1', [[]]);
  });

  it('genera el producto cartesiano de los valores elegidos por atributo', async () => {
    atributosRepository.buscarPorId.mockImplementation(
      ((id: string) =>
        Promise.resolve(
          id === 'talla'
            ? { id: 'talla', nombre: 'Talla', valores: [{ id: 'S' }, { id: 'M' }] }
            : { id: 'color', nombre: 'Color', valores: [{ id: 'rojo' }, { id: 'azul' }] },
        )) as never,
    );

    await service.generarCombinaciones('p1', 't1', [
      { atributoId: 'talla', valoresIds: ['S', 'M'] },
      { atributoId: 'color', valoresIds: ['rojo', 'azul'] },
    ]);

    expect(variantesRepository.regenerar).toHaveBeenCalledWith('p1', 't1', [
      ['S', 'rojo'],
      ['S', 'azul'],
      ['M', 'rojo'],
      ['M', 'azul'],
    ]);
  });

  it('rechaza un atributo elegido sin ningún valor seleccionado', async () => {
    await expect(service.generarCombinaciones('p1', 't1', [{ atributoId: 'talla', valoresIds: [] }])).rejects.toThrow(
      BadRequestException,
    );
    expect(variantesRepository.regenerar).not.toHaveBeenCalled();
  });

  it('rechaza un valorId que no pertenece al atributo indicado', async () => {
    atributosRepository.buscarPorId.mockResolvedValue({ id: 'talla', nombre: 'Talla', valores: [{ id: 'S' }] } as never);

    await expect(
      service.generarCombinaciones('p1', 't1', [{ atributoId: 'talla', valoresIds: ['no-existe'] }]),
    ).rejects.toThrow(BadRequestException);
    expect(variantesRepository.regenerar).not.toHaveBeenCalled();
  });

  it('rechaza regenerar si las variantes actuales ya tienen movimientos de inventario', async () => {
    variantesRepository.listarPorProducto.mockResolvedValue([{ id: 'v-vieja' }] as never);
    variantesRepository.contarMovimientos.mockResolvedValue(3);

    await expect(service.generarCombinaciones('p1', 't1', [])).rejects.toThrow(BadRequestException);
    expect(variantesRepository.regenerar).not.toHaveBeenCalled();
  });

  it('rechaza regenerar si las variantes actuales ya tienen líneas de venta/compra (cotización/remisión/OC sin movimiento de stock)', async () => {
    variantesRepository.listarPorProducto.mockResolvedValue([{ id: 'v-vieja' }] as never);
    variantesRepository.contarUsoEnLineas.mockResolvedValue(1);

    await expect(service.generarCombinaciones('p1', 't1', [])).rejects.toThrow(BadRequestException);
    expect(variantesRepository.regenerar).not.toHaveBeenCalled();
  });

  it('rechaza una combinatoria que excede el máximo soportado', async () => {
    atributosRepository.buscarPorId.mockImplementation(
      ((id: string) =>
        Promise.resolve({
          id,
          nombre: id,
          valores: Array.from({ length: 21 }, (_, i) => ({ id: `${id}-${i}` })),
        })) as never,
    );

    await expect(
      service.generarCombinaciones('p1', 't1', [
        { atributoId: 'a', valoresIds: Array.from({ length: 21 }, (_, i) => `a-${i}`) },
        { atributoId: 'b', valoresIds: Array.from({ length: 21 }, (_, i) => `b-${i}`) },
      ]),
    ).rejects.toThrow(BadRequestException);
    expect(variantesRepository.regenerar).not.toHaveBeenCalled();
  });

  describe('resolverObligatoria', () => {
    it('resuelve sola cuando el producto tiene una única variante y no se indica varianteId', async () => {
      variantesRepository.listarIdsPorProducto.mockResolvedValue([{ id: 'v-unica' }] as never);

      const resultado = await service.resolverObligatoria('p1');

      expect(resultado).toBe('v-unica');
    });

    it('rechaza (400) si el producto tiene varias variantes y no se indica varianteId', async () => {
      variantesRepository.listarIdsPorProducto.mockResolvedValue([{ id: 'v1' }, { id: 'v2' }] as never);

      await expect(service.resolverObligatoria('p1')).rejects.toThrow(BadRequestException);
    });

    it('usa el varianteId explícito si pertenece al producto', async () => {
      variantesRepository.listarIdsPorProducto.mockResolvedValue([{ id: 'v1' }, { id: 'v2' }] as never);

      const resultado = await service.resolverObligatoria('p1', 'v2');

      expect(resultado).toBe('v2');
    });

    it('rechaza (400) si el varianteId explícito no pertenece al producto', async () => {
      variantesRepository.listarIdsPorProducto.mockResolvedValue([{ id: 'v1' }] as never);

      await expect(service.resolverObligatoria('p1', 'v-ajena')).rejects.toThrow(BadRequestException);
    });

    it('rechaza (404) si el producto no tiene ninguna variante — no existe o es de otro tenant', async () => {
      variantesRepository.listarIdsPorProducto.mockResolvedValue([]);

      await expect(service.resolverObligatoria('producto-inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  describe('actualizarCodigoBarras', () => {
    it('actualiza el código cuando la variante pertenece al producto', async () => {
      variantesRepository.listarIdsPorProducto.mockResolvedValue([{ id: 'v1' }, { id: 'v2' }] as never);

      await service.actualizarCodigoBarras('p1', 'v2', '7501234567890');

      expect(variantesRepository.actualizarCodigoBarras).toHaveBeenCalledWith('v2', '7501234567890');
    });

    it('rechaza (400) si la variante indicada no pertenece al producto', async () => {
      variantesRepository.listarIdsPorProducto.mockResolvedValue([{ id: 'v1' }] as never);

      await expect(service.actualizarCodigoBarras('p1', 'v-ajena', '7501234567890')).rejects.toThrow(
        BadRequestException,
      );
      expect(variantesRepository.actualizarCodigoBarras).not.toHaveBeenCalled();
    });
  });
});
