import { NotFoundException } from '@nestjs/common';
import { InmobiliariaPublicaService } from './inmobiliaria-publica.service';
import * as resolverModule from './resolver-tenant-publico-inmobiliaria';

describe('InmobiliariaPublicaService', () => {
  let service: InmobiliariaPublicaService;
  let prisma: { propiedad: { findMany: jest.Mock; count: jest.Mock; findFirst: jest.Mock }; alertaBusquedaPropiedad: { create: jest.Mock } };
  const TENANT = { id: 't1', nombre: 'Inmobiliaria Vega', logo: 'data:image/png;base64,xxx' };

  beforeEach(() => {
    prisma = {
      propiedad: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn() },
      alertaBusquedaPropiedad: { create: jest.fn().mockResolvedValue({ id: 'al1' }) },
    };
    jest.spyOn(resolverModule, 'resolverTenantPublicoInmobiliaria').mockResolvedValue(TENANT as never);
    service = new InmobiliariaPublicaService(prisma as never);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('config', () => {
    it('devuelve nombre y logo del tenant ya resuelto', async () => {
      const resultado = await service.config('vega');
      expect(resultado).toEqual({ nombre: 'Inmobiliaria Vega', logo: TENANT.logo });
    });
  });

  describe('listar', () => {
    it('siempre filtra por tenantId resuelto y estado ACTIVA — nunca expone pausadas/vendidas', async () => {
      await service.listar('vega', {});
      const [where] = prisma.propiedad.findMany.mock.calls[0];
      expect(where.where).toEqual(expect.objectContaining({ tenantId: 't1', estado: 'ACTIVA' }));
    });

    it('aplica el rango de precio si viene informado', async () => {
      await service.listar('vega', { precioMin: 100000, precioMax: 300000 } as never);
      const [where] = prisma.propiedad.findMany.mock.calls[0];
      expect(where.where.precio).toEqual({ gte: 100000, lte: 300000 });
    });
  });

  describe('buscarPorId', () => {
    it('rechaza con 404 si no existe o pertenece a otro tenant (findFirst con tenantId ya resuelto)', async () => {
      prisma.propiedad.findFirst.mockResolvedValue(null);
      await expect(service.buscarPorId('vega', 'p1')).rejects.toThrow(NotFoundException);
    });

    it('rechaza con 404 si existe pero no está ACTIVA (filtrado en el where, no en código)', async () => {
      prisma.propiedad.findFirst.mockResolvedValue(null);
      await expect(service.buscarPorId('vega', 'p1')).rejects.toThrow('Propiedad no encontrada');
      expect(prisma.propiedad.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1', tenantId: 't1', estado: 'ACTIVA' } }));
    });

    it('devuelve la propiedad si existe, es del tenant y está ACTIVA', async () => {
      prisma.propiedad.findFirst.mockResolvedValue({ id: 'p1' });
      const resultado = await service.buscarPorId('vega', 'p1');
      expect(resultado).toEqual({ id: 'p1' });
    });
  });

  describe('crearAlerta', () => {
    it('guarda la alerta con el tenantId ya resuelto por subdominio', async () => {
      await service.crearAlerta('vega', { email: 'visitante@example.com', precioMax: 200000 } as never);
      expect(prisma.alertaBusquedaPropiedad.create).toHaveBeenCalledWith({
        data: { email: 'visitante@example.com', precioMax: 200000, tenantId: 't1' },
      });
    });
  });
});
