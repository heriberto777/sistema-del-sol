import { BadRequestException } from '@nestjs/common';
import { CuentasContablesService } from './cuentas-contables.service';
import { CuentasContablesRepository } from './cuentas-contables.repository';
import { CUENTAS_CATALOGO_COMPLETO, CODIGOS_CUENTA } from './cuentas-base';

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
      resolverRolDeCuenta: jest.fn(),
      listarConfiguracionCuentasSistema: jest.fn(),
      guardarConfiguracionCuentaSistema: jest.fn(),
      eliminarConfiguracionCuentaSistema: jest.fn(),
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

  describe('configurarCuentaSistema (docs/PLAN.md, punto 4 — override por tenant de los códigos fijos)', () => {
    it('rechaza una clave que no es un rol real de CODIGOS_CUENTA', async () => {
      await expect(service.configurarCuentaSistema('NO_EXISTE', 'cuenta-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.guardarConfiguracionCuentaSistema).not.toHaveBeenCalled();
    });

    it('rechaza una cuenta inactiva', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'cuenta-1', tipo: 'ACTIVO', activa: false } as never);

      await expect(service.configurarCuentaSistema('CAJA_BANCOS', 'cuenta-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.guardarConfiguracionCuentaSistema).not.toHaveBeenCalled();
    });

    it('rechaza una cuenta de un tipo distinto al que el rol espera (CAJA_BANCOS es ACTIVO, no GASTO)', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'cuenta-1', tipo: 'GASTO', activa: true } as never);

      await expect(service.configurarCuentaSistema('CAJA_BANCOS', 'cuenta-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.guardarConfiguracionCuentaSistema).not.toHaveBeenCalled();
    });

    it('con una cuenta activa del tipo correcto, guarda el override', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'cuenta-1', tipo: 'ACTIVO', activa: true } as never);

      await service.configurarCuentaSistema('CAJA_BANCOS', 'cuenta-1', 'tenant-1');

      expect(repository.guardarConfiguracionCuentaSistema).toHaveBeenCalledWith('tenant-1', 'CAJA_BANCOS', 'cuenta-1');
    });

    it('propaga el 404 si la cuenta elegida es de otro tenant (buscarPorId tenant-scoped)', async () => {
      repository.buscarPorId.mockRejectedValue(new Error('no encontrada'));

      await expect(service.configurarCuentaSistema('CAJA_BANCOS', 'cuenta-otro-tenant', 'tenant-1')).rejects.toThrow();
      expect(repository.guardarConfiguracionCuentaSistema).not.toHaveBeenCalled();
    });
  });

  describe('listarConfiguracionCuentasSistema', () => {
    it('devuelve los 15 roles aunque ninguno tenga override configurado', async () => {
      repository.listarConfiguracionCuentasSistema.mockResolvedValue([]);

      const resultado = await service.listarConfiguracionCuentasSistema('tenant-1');

      expect(resultado).toHaveLength(Object.keys(CODIGOS_CUENTA).length);
      expect(resultado.every((r) => r.cuentaConfigurada === null)).toBe(true);
    });

    it('un rol con override configurado trae su cuenta, los demás siguen en null', async () => {
      const cuentaOverride = { id: 'cuenta-override', codigo: '1011', nombre: 'Banco Popular' };
      repository.listarConfiguracionCuentasSistema.mockResolvedValue([
        { clave: 'CAJA_BANCOS', cuentaContable: cuentaOverride } as never,
      ]);

      const resultado = await service.listarConfiguracionCuentasSistema('tenant-1');

      const filaCaja = resultado.find((r) => r.clave === 'CAJA_BANCOS');
      expect(filaCaja?.cuentaConfigurada).toEqual(cuentaOverride);
      expect(resultado.filter((r) => r.clave !== 'CAJA_BANCOS').every((r) => r.cuentaConfigurada === null)).toBe(true);
    });
  });

  describe('quitarConfiguracionCuentaSistema', () => {
    it('delega en el repositorio (vuelve al código fijo de siempre)', async () => {
      await service.quitarConfiguracionCuentaSistema('CAJA_BANCOS', 'tenant-1');

      expect(repository.eliminarConfiguracionCuentaSistema).toHaveBeenCalledWith('tenant-1', 'CAJA_BANCOS');
    });
  });
});
