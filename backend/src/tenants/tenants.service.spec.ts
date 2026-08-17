import { TenantsService } from './tenants.service';
import { TenantsRepository } from './tenants.repository';
import { CrearTenantDto } from './dto/crear-tenant.dto';

describe('TenantsService', () => {
  let service: TenantsService;
  let repository: jest.Mocked<TenantsRepository>;

  beforeEach(() => {
    repository = {
      crearConProvisioning: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      actualizar: jest.fn(),
    } as unknown as jest.Mocked<TenantsRepository>;
    service = new TenantsService(repository);
  });

  const dto: CrearTenantDto = {
    nombre: 'Cliente X',
    subdominio: 'cliente-x',
    planId: 'plan-1',
    adminEmail: 'admin@cliente-x.com',
    adminNombre: 'Admin X',
    adminPassword: 'ClienteX123!',
  };

  it('nunca envía la contraseña en texto plano al repositorio — siempre un hash', async () => {
    repository.crearConProvisioning.mockResolvedValue({ id: 't1' } as never);

    await service.crear(dto);

    const [[args]] = repository.crearConProvisioning.mock.calls;
    expect(args.adminPasswordHash).not.toBe(dto.adminPassword);
    expect(args.adminPasswordHash.length).toBeGreaterThan(20);
  });

  it('propaga nombre/subdominio/rnc/email/nombre del admin sin transformarlos', async () => {
    repository.crearConProvisioning.mockResolvedValue({ id: 't1' } as never);

    await service.crear({ ...dto, rnc: '123456789' });

    expect(repository.crearConProvisioning).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Cliente X',
        subdominio: 'cliente-x',
        rnc: '123456789',
        planId: 'plan-1',
        adminEmail: 'admin@cliente-x.com',
        adminNombre: 'Admin X',
      }),
    );
  });

  it('delega listar/buscarPorId/actualizar al repositorio', () => {
    service.listar();
    expect(repository.listar).toHaveBeenCalled();

    service.buscarPorId('t1');
    expect(repository.buscarPorId).toHaveBeenCalledWith('t1');

    service.actualizar('t1', { estado: 'SUSPENDIDO' });
    expect(repository.actualizar).toHaveBeenCalledWith('t1', { estado: 'SUSPENDIDO' });
  });
});
