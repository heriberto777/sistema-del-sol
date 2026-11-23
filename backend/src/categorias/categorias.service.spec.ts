import { BadRequestException } from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { CategoriasRepository } from './categorias.repository';
import { CuentasContablesService } from '../contabilidad/cuentas-contables.service';

describe('CategoriasService', () => {
  let service: CategoriasService;
  let repository: jest.Mocked<CategoriasRepository>;
  let cuentasContablesService: jest.Mocked<CuentasContablesService>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      actualizar: jest.fn(),
      eliminar: jest.fn(),
    } as unknown as jest.Mocked<CategoriasRepository>;
    cuentasContablesService = { buscarPorId: jest.fn().mockResolvedValue({ id: 'cuenta-1' }) } as unknown as jest.Mocked<CuentasContablesService>;
    service = new CategoriasService(repository, cuentasContablesService);
  });

  describe('crear', () => {
    it('crea una categoría raíz sin validar nada si no manda categoriaPadreId', async () => {
      await service.crear({ nombre: 'Bebidas' }, 'tenant-1');

      expect(repository.buscarPorId).not.toHaveBeenCalled();
      expect(repository.crear).toHaveBeenCalledWith({ nombre: 'Bebidas' }, 'tenant-1');
    });

    it('valida que categoriaPadreId pertenezca al tenant antes de crear (404 si no, vía findUniqueOrThrow tenant-scoped)', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'padre-1', categoriaPadreId: null } as never);

      await service.crear({ nombre: 'Gaseosas', categoriaPadreId: 'padre-1' }, 'tenant-1');

      expect(repository.buscarPorId).toHaveBeenCalledWith('padre-1');
      expect(repository.crear).toHaveBeenCalledWith({ nombre: 'Gaseosas', categoriaPadreId: 'padre-1' }, 'tenant-1');
    });

    it('valida que cuentaIngresoId/cuentaCostoId pertenezcan al tenant antes de crear (docs/PLAN.md, punto 2)', async () => {
      const dto = { nombre: 'Servicios', cuentaIngresoId: 'cuenta-ingreso-1', cuentaCostoId: 'cuenta-costo-1' };

      await service.crear(dto, 'tenant-1');

      expect(cuentasContablesService.buscarPorId).toHaveBeenCalledWith('cuenta-ingreso-1');
      expect(cuentasContablesService.buscarPorId).toHaveBeenCalledWith('cuenta-costo-1');
      expect(repository.crear).toHaveBeenCalledWith(dto, 'tenant-1');
    });

    it('propaga el 404 si cuentaIngresoId es de otro tenant (findUniqueOrThrow tenant-scoped)', async () => {
      cuentasContablesService.buscarPorId.mockRejectedValue(new Error('no encontrada'));

      await expect(service.crear({ nombre: 'Servicios', cuentaIngresoId: 'cuenta-otro-tenant' }, 'tenant-1')).rejects.toThrow();
      expect(repository.crear).not.toHaveBeenCalled();
    });
  });

  describe('actualizar', () => {
    it('rechaza asignarse a sí misma como categoría padre', async () => {
      await expect(service.actualizar('cat-1', { categoriaPadreId: 'cat-1' })).rejects.toThrow(BadRequestException);
      expect(repository.actualizar).not.toHaveBeenCalled();
    });

    it('rechaza asignar como padre a una de sus propias subcategorías (ciclo)', async () => {
      // cat-1 -> hija cat-2 -> nieta cat-3. Intentar poner a cat-1 como hija de cat-3 crearía un ciclo.
      repository.buscarPorId.mockImplementation(((id: string) => {
        if (id === 'cat-3') return Promise.resolve({ id: 'cat-3', categoriaPadreId: 'cat-2' });
        if (id === 'cat-2') return Promise.resolve({ id: 'cat-2', categoriaPadreId: 'cat-1' });
        return Promise.resolve({ id: 'cat-1', categoriaPadreId: null });
      }) as never);

      await expect(service.actualizar('cat-1', { categoriaPadreId: 'cat-3' })).rejects.toThrow(BadRequestException);
      expect(repository.actualizar).not.toHaveBeenCalled();
    });

    it('permite reasignar a un padre que no es descendiente', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'otra-raiz', categoriaPadreId: null } as never);

      await service.actualizar('cat-1', { categoriaPadreId: 'otra-raiz' });

      expect(repository.actualizar).toHaveBeenCalledWith('cat-1', { categoriaPadreId: 'otra-raiz' });
    });
  });

  describe('eliminar', () => {
    it('rechaza eliminar una categoría con productos asignados', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'cat-1', _count: { productos: 3, subcategorias: 0 } } as never);

      await expect(service.eliminar('cat-1')).rejects.toThrow(BadRequestException);
      expect(repository.eliminar).not.toHaveBeenCalled();
    });

    it('rechaza eliminar una categoría con subcategorías', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'cat-1', _count: { productos: 0, subcategorias: 2 } } as never);

      await expect(service.eliminar('cat-1')).rejects.toThrow(BadRequestException);
      expect(repository.eliminar).not.toHaveBeenCalled();
    });

    it('elimina una categoría vacía (sin productos ni subcategorías)', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'cat-1', _count: { productos: 0, subcategorias: 0 } } as never);

      await service.eliminar('cat-1');

      expect(repository.eliminar).toHaveBeenCalledWith('cat-1');
    });
  });
});
