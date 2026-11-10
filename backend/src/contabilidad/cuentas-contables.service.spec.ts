import { CuentasContablesService } from './cuentas-contables.service';
import { CuentasContablesRepository } from './cuentas-contables.repository';
import { CUENTAS_CATALOGO_COMPLETO } from './cuentas-base';

describe('CuentasContablesService', () => {
  let service: CuentasContablesService;
  let repository: jest.Mocked<CuentasContablesRepository>;

  beforeEach(() => {
    repository = {
      listar: jest.fn(),
      listarTodasLasCuentas: jest.fn(),
      crear: jest.fn(),
      buscarPorCodigo: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorCodigoGlobal: jest.fn(),
      buscarCuentaBancariaConContable: jest.fn(),
    } as unknown as jest.Mocked<CuentasContablesRepository>;
    service = new CuentasContablesService(repository);
  });

  describe('completarCatalogo', () => {
    it('sin ninguna cuenta previa, crea las del catálogo completo', async () => {
      repository.listarTodasLasCuentas.mockResolvedValue([]);
      let contador = 0;
      (repository.crear as jest.Mock).mockImplementation(async () => ({ id: `nueva-${contador++}` }));

      const resultado = await service.completarCatalogo('tenant-1');

      expect(repository.crear).toHaveBeenCalledTimes(CUENTAS_CATALOGO_COMPLETO.length);
      expect(resultado).toEqual({ creadas: CUENTAS_CATALOGO_COMPLETO.length, total: CUENTAS_CATALOGO_COMPLETO.length });
    });

    it('salta un código que ya existe (idempotente) sin intentar crearlo de nuevo', async () => {
      repository.listarTodasLasCuentas.mockResolvedValue([{ id: 'existente-1070', codigo: '1070' }] as never);
      repository.crear.mockResolvedValue({ id: 'nueva' } as never);

      await service.completarCatalogo('tenant-1');

      expect(repository.crear).not.toHaveBeenCalledWith(expect.objectContaining({ codigo: '1070' }));
      expect(repository.crear).toHaveBeenCalledTimes(CUENTAS_CATALOGO_COMPLETO.length - 1);
    });

    it('presionarlo dos veces no duplica nada la segunda vez', async () => {
      repository.listarTodasLasCuentas.mockResolvedValue(
        CUENTAS_CATALOGO_COMPLETO.map((c, i) => ({ id: `cuenta-${i}`, codigo: c.codigo })) as never,
      );

      const resultado = await service.completarCatalogo('tenant-1');

      expect(repository.crear).not.toHaveBeenCalled();
      expect(resultado).toEqual({ creadas: 0, total: CUENTAS_CATALOGO_COMPLETO.length });
    });

    it('resuelve cuentaPadreId de una subcuenta contra el id recién creado del padre (mismo recorrido, el padre va antes en el array)', async () => {
      repository.listarTodasLasCuentas.mockResolvedValue([]);
      (repository.crear as jest.Mock).mockImplementation(async (params: { codigo: string }) => ({ id: `id-${params.codigo}` }));

      await service.completarCatalogo('tenant-1');

      // 1070 SÍ está en CUENTAS_CATALOGO_COMPLETO (se crea en esta misma
      // corrida) — caso real de "padre recién creado". 5020 en cambio es
      // de CUENTAS_BASE (ya sembrada al crear el tenant, nunca la crea
      // este servicio) — ese caso lo cubre el test de abajo, con el padre
      // ya existente desde el arranque.
      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ codigo: '1071', cuentaPadreId: 'id-1070' }));
    });

    it('una subcuenta cuyo padre YA existía (no se crea en esta corrida) igual resuelve cuentaPadreId contra el id existente', async () => {
      repository.listarTodasLasCuentas.mockResolvedValue([{ id: 'padre-ya-existente', codigo: '5020' }] as never);
      repository.crear.mockResolvedValue({ id: 'nueva' } as never);

      await service.completarCatalogo('tenant-1');

      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ codigo: '5021', cuentaPadreId: 'padre-ya-existente' }));
    });

    it('una cuenta sin padreCodigo no manda cuentaPadreId', async () => {
      repository.listarTodasLasCuentas.mockResolvedValue([]);
      repository.crear.mockResolvedValue({ id: 'nueva' } as never);

      await service.completarCatalogo('tenant-1');

      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ codigo: '1050', cuentaPadreId: undefined }));
    });
  });
});
