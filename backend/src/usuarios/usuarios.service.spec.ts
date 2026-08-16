import { BadRequestException } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuariosRepository } from './usuarios.repository';

describe('UsuariosService — roles', () => {
  let service: UsuariosService;
  let repository: jest.Mocked<UsuariosRepository>;

  beforeEach(() => {
    repository = {
      listarPermisos: jest.fn(),
      buscarRolPorId: jest.fn(),
      crearRol: jest.fn(),
      actualizarRol: jest.fn(),
      eliminarRol: jest.fn(),
      contarUsuariosConRol: jest.fn(),
    } as unknown as jest.Mocked<UsuariosRepository>;
    service = new UsuariosService(repository);
  });

  describe('crearRol', () => {
    it('delega en el repositorio con tenantId y los permisos del DTO', async () => {
      repository.crearRol.mockResolvedValue({ id: 'r1' } as never);

      await service.crearRol({ nombre: 'Supervisor', descripcion: 'Sucursal', permisos: ['inventario.ver'] }, 'tenant-1');

      expect(repository.crearRol).toHaveBeenCalledWith('tenant-1', 'Supervisor', 'Sucursal', ['inventario.ver']);
    });
  });

  describe('actualizarRol', () => {
    it('delega en el repositorio con los campos del DTO', async () => {
      repository.actualizarRol.mockResolvedValue({ id: 'r1' } as never);

      await service.actualizarRol('r1', { nombre: 'Nuevo nombre', permisos: ['inventario.ver', 'inventario.ajustar'] });

      expect(repository.actualizarRol).toHaveBeenCalledWith('r1', { nombre: 'Nuevo nombre', permisos: ['inventario.ver', 'inventario.ajustar'] });
    });
  });

  describe('eliminarRol', () => {
    it('rechaza eliminar un rol del sistema', async () => {
      repository.buscarRolPorId.mockResolvedValue({ id: 'r1', esSistema: true } as never);

      await expect(service.eliminarRol('r1')).rejects.toThrow(BadRequestException);
      expect(repository.eliminarRol).not.toHaveBeenCalled();
    });

    it('rechaza eliminar un rol que tiene usuarios asignados', async () => {
      repository.buscarRolPorId.mockResolvedValue({ id: 'r1', esSistema: false } as never);
      repository.contarUsuariosConRol.mockResolvedValue(2);

      await expect(service.eliminarRol('r1')).rejects.toThrow(BadRequestException);
      expect(repository.eliminarRol).not.toHaveBeenCalled();
    });

    it('elimina un rol personalizado sin usuarios asignados', async () => {
      repository.buscarRolPorId.mockResolvedValue({ id: 'r1', esSistema: false } as never);
      repository.contarUsuariosConRol.mockResolvedValue(0);
      repository.eliminarRol.mockResolvedValue({ id: 'r1' } as never);

      await service.eliminarRol('r1');

      expect(repository.eliminarRol).toHaveBeenCalledWith('r1');
    });
  });
});
