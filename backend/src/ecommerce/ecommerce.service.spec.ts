import { NotFoundException } from '@nestjs/common';
import { EcommerceService } from './ecommerce.service';
import { EcommerceRepository } from './ecommerce.repository';

const TENANT_ACTIVO = { id: 't1', nombre: 'Tenant Demo', estado: 'ACTIVO' };

describe('EcommerceService', () => {
  let service: EcommerceService;
  let prisma: {
    tenant: { findUnique: jest.Mock };
    tenantModuloOverride: { findFirst: jest.Mock };
    configuracion: { findMany: jest.Mock };
  };
  let ecommerceRepository: jest.Mocked<EcommerceRepository>;

  beforeEach(() => {
    prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ ...TENANT_ACTIVO, plan: { modulos: [{ modulo: { clave: 'ecommerce' } }] } }) },
      tenantModuloOverride: { findFirst: jest.fn().mockResolvedValue(null) },
      configuracion: {
        findMany: jest.fn().mockResolvedValue([
          { clave: 'TIENDA_ACTIVA', valor: 'true' },
          { clave: 'TIENDA_PLANTILLA', valor: 'MERCADO' },
        ]),
      },
    };
    ecommerceRepository = {
      buscarTenantPorSubdominio: jest.fn().mockResolvedValue(TENANT_ACTIVO),
      catalogo: jest.fn().mockResolvedValue([[], 0]),
      buscarProductoPublico: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<EcommerceRepository>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new EcommerceService(prisma as any, ecommerceRepository);
  });

  describe('resolverTiendaPublica', () => {
    it('404 si el tenant no existe', async () => {
      ecommerceRepository.buscarTenantPorSubdominio.mockResolvedValue(null);
      await expect(service.resolverTiendaPublica('inexistente')).rejects.toThrow(NotFoundException);
    });

    it('404 si el tenant no está ACTIVO (suspendido/cancelado)', async () => {
      ecommerceRepository.buscarTenantPorSubdominio.mockResolvedValue({ ...TENANT_ACTIVO, estado: 'SUSPENDIDO' } as never);
      await expect(service.resolverTiendaPublica('demo')).rejects.toThrow(NotFoundException);
    });

    it('404 si el tenant no tiene el módulo "ecommerce" activo', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ ...TENANT_ACTIVO, plan: { modulos: [] } });
      await expect(service.resolverTiendaPublica('demo')).rejects.toThrow(NotFoundException);
    });

    it('404 si el módulo está activo pero la tienda no fue activada en su configuración', async () => {
      prisma.configuracion.findMany.mockResolvedValue([{ clave: 'TIENDA_ACTIVA', valor: 'false' }]);
      await expect(service.resolverTiendaPublica('demo')).rejects.toThrow(NotFoundException);
    });

    it('resuelve tenant + config cuando todo está en orden', async () => {
      const resultado = await service.resolverTiendaPublica('demo');
      expect(resultado.tenant.id).toBe('t1');
      expect(resultado.config.activa).toBe(true);
      expect(resultado.config.plantilla).toBe('MERCADO');
    });
  });

  describe('obtenerConfig', () => {
    it('usa el nombre del tenant si TIENDA_NOMBRE no está configurado', async () => {
      const config = await service.obtenerConfig('demo');
      expect(config.nombre).toBe('Tenant Demo');
      expect(config.plantilla).toBe('MERCADO');
    });
  });

  describe('producto', () => {
    it('404 si el producto no existe o no es visible en la tienda', async () => {
      await expect(service.producto('demo', 'p1')).rejects.toThrow(NotFoundException);
    });
  });
});
