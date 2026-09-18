import { ConfiguracionesService } from './configuraciones.service';
import { ConfiguracionesRepository } from './configuraciones.repository';
import { PrismaService } from '../prisma/prisma.service';
import { CONFIGURACIONES_BASE } from '../tenants/roles-base';

/** Todas las claves de CONFIGURACIONES_BASE ya sembradas (menos DOCUMENTO_LOGO, que nunca vive en Configuracion) — para los tests que no quieren probar la síntesis de claves faltantes. */
const TODAS_SEMBRADAS = Object.entries(CONFIGURACIONES_BASE)
  .filter(([clave]) => clave !== 'DOCUMENTO_LOGO')
  .map(([clave, valor]) => ({ clave, valor }));

describe('ConfiguracionesService', () => {
  let service: ConfiguracionesService;
  let repository: jest.Mocked<ConfiguracionesRepository>;
  let prisma: { tenant: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(() => {
    repository = {
      listar: jest.fn(),
      actualizar: jest.fn(),
      buscarPorClave: jest.fn(),
    } as unknown as jest.Mocked<ConfiguracionesRepository>;
    prisma = { tenant: { findUnique: jest.fn(), update: jest.fn() } };
    service = new ConfiguracionesService(repository, prisma as unknown as PrismaService);
  });

  describe('buscarValor', () => {
    it('devuelve el valor guardado si el tenant tiene la clave sembrada', async () => {
      repository.buscarPorClave.mockResolvedValue({ valor: '200' } as never);

      const resultado = await service.buscarValor('POS_TOLERANCIA_ARQUEO', 'tenant-1', '50');

      expect(resultado).toBe('200');
    });

    it('cae al valor por defecto si el tenant no tiene la clave sembrada', async () => {
      repository.buscarPorClave.mockResolvedValue(null);

      const resultado = await service.buscarValor('POS_TOLERANCIA_ARQUEO', 'tenant-1', '50');

      expect(resultado).toBe('50');
    });
  });

  describe('listar', () => {
    it('agrega un row sintético DOCUMENTO_LOGO con Tenant.logo, sin tocar Configuracion', async () => {
      repository.listar.mockResolvedValue(TODAS_SEMBRADAS as never);
      prisma.tenant.findUnique.mockResolvedValue({ logo: 'data:image/png;base64,abc' });

      const resultado = await service.listar('tenant-1');

      expect(resultado).toEqual([...TODAS_SEMBRADAS, { clave: 'DOCUMENTO_LOGO', valor: 'data:image/png;base64,abc' }]);
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: 'tenant-1' }, select: { logo: true } });
    });

    it('devuelve valor vacío si el tenant no tiene logo', async () => {
      repository.listar.mockResolvedValue(TODAS_SEMBRADAS as never);
      prisma.tenant.findUnique.mockResolvedValue({ logo: null });

      const resultado = await service.listar('tenant-1');

      expect(resultado).toEqual([...TODAS_SEMBRADAS, { clave: 'DOCUMENTO_LOGO', valor: '' }]);
    });

    it('completa con el valor por defecto cualquier clave de CONFIGURACIONES_BASE que el tenant todavía no tenga sembrada (ej. agregada en un deploy posterior)', async () => {
      repository.listar.mockResolvedValue([]);
      prisma.tenant.findUnique.mockResolvedValue({ logo: null });

      const resultado = await service.listar('tenant-1');

      expect(resultado).toContainEqual({ clave: 'PLANTILLA_DOCUMENTO_DEFAULT', valor: 'CLASICO' });
      expect(resultado).toContainEqual({ clave: 'FORMATO_IMPRESION_DEFAULT', valor: 'CARTA' });
    });

    it('no duplica una clave que el tenant ya tiene sembrada con un valor distinto al default', async () => {
      repository.listar.mockResolvedValue([{ clave: 'PLANTILLA_DOCUMENTO_DEFAULT', valor: 'EDITORIAL' }] as never);
      prisma.tenant.findUnique.mockResolvedValue({ logo: null });

      const resultado = await service.listar('tenant-1');
      const filasPlantilla = resultado.filter((c) => c.clave === 'PLANTILLA_DOCUMENTO_DEFAULT');

      expect(filasPlantilla).toEqual([{ clave: 'PLANTILLA_DOCUMENTO_DEFAULT', valor: 'EDITORIAL' }]);
    });
  });

  describe('actualizar', () => {
    it('DOCUMENTO_LOGO escribe en Tenant.logo, no en Configuracion', async () => {
      prisma.tenant.update.mockResolvedValue({ id: 'tenant-1', logo: 'data:image/png;base64,nuevo' });

      await service.actualizar('DOCUMENTO_LOGO', 'data:image/png;base64,nuevo', 'tenant-1');

      expect(prisma.tenant.update).toHaveBeenCalledWith({ where: { id: 'tenant-1' }, data: { logo: 'data:image/png;base64,nuevo' } });
      expect(repository.actualizar).not.toHaveBeenCalled();
    });

    it('DOCUMENTO_LOGO con valor vacío guarda null (borra el logo)', async () => {
      await service.actualizar('DOCUMENTO_LOGO', '', 'tenant-1');

      expect(prisma.tenant.update).toHaveBeenCalledWith({ where: { id: 'tenant-1' }, data: { logo: null } });
    });

    it('cualquier otra clave sigue yendo al repositorio genérico', async () => {
      await service.actualizar('DOCUMENTO_NOTA_PIE', 'Gracias', 'tenant-1');

      expect(repository.actualizar).toHaveBeenCalledWith('DOCUMENTO_NOTA_PIE', 'Gracias', 'tenant-1');
      expect(prisma.tenant.update).not.toHaveBeenCalled();
    });
  });
});
