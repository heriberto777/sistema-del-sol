import { LeadsEventosService } from './leads-eventos.service';
import { PrismaService } from '../prisma/prisma.service';
import * as resolverModulosActivos from '../planes/resolver-modulos-activos';

const ADMIN = { id: 'admin-1' };

describe('LeadsEventosService (CRM "Cotización conectada" Fase 2)', () => {
  let service: LeadsEventosService;
  let prisma: {
    modulo: { findUnique: jest.Mock };
    tenant: { findUnique: jest.Mock };
    lead: { findFirst: jest.Mock; create: jest.Mock };
    user: { findFirst: jest.Mock };
    actividadCrm: { create: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      // moduloEstaActivo() resuelve el Plan del tenant — se mockea completo para no acoplar el test a su implementación interna.
      modulo: { findUnique: jest.fn() },
      tenant: { findUnique: jest.fn() },
      lead: { findFirst: jest.fn(), create: jest.fn() },
      user: { findFirst: jest.fn().mockResolvedValue(ADMIN) },
      actividadCrm: { create: jest.fn().mockResolvedValue({ id: 'a1' }) },
    };
    service = new LeadsEventosService(prisma as unknown as PrismaService);
  });

  function mockCrmActivo(activo: boolean) {
    jest.spyOn(resolverModulosActivos, 'moduloEstaActivo').mockResolvedValue(activo);
  }

  afterEach(() => jest.restoreAllMocks());

  it('no hace nada si el módulo CRM no está activo para el tenant', async () => {
    mockCrmActivo(false);

    await service.alConsultarProductoDesconocido({ tenantId: 't1', telefono: '8095551234', nombre: 'Ana', productoNombre: 'Yogurt', origen: 'WHATSAPP' });

    expect(prisma.lead.findFirst).not.toHaveBeenCalled();
  });

  describe('con CRM activo', () => {
    beforeEach(() => mockCrmActivo(true));

    it('crea un Lead nuevo (origen WHATSAPP) si no existe uno con ese teléfono', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);
      prisma.lead.create.mockResolvedValue({ id: 'l1', vendedorId: null });

      await service.alConsultarProductoDesconocido({ tenantId: 't1', telefono: '8095551234', nombre: 'Ana', productoNombre: 'Yogurt Fresa', origen: 'WHATSAPP' });

      expect(prisma.lead.create).toHaveBeenCalledWith({
        data: { tenantId: 't1', nombre: 'Ana', telefono: '8095551234', origen: 'WHATSAPP' },
      });
      expect(prisma.actividadCrm.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipo: 'NOTA', leadId: 'l1', usuarioId: 'admin-1', descripcion: expect.stringContaining('Yogurt Fresa') }),
      });
    });

    it('mapea origen TIENDA a FORMULARIO_WEB en el Lead', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);
      prisma.lead.create.mockResolvedValue({ id: 'l1', vendedorId: null });

      await service.alConsultarProductoDesconocido({ tenantId: 't1', telefono: '8095551234', nombre: 'Ana', productoNombre: 'Yogurt', origen: 'TIENDA' });

      expect(prisma.lead.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ origen: 'FORMULARIO_WEB' }) }));
    });

    it('reusa el Lead existente por teléfono en vez de duplicarlo', async () => {
      prisma.lead.findFirst.mockResolvedValue({ id: 'l-existente', vendedorId: 'vendedor-asignado' });

      await service.alConsultarProductoDesconocido({ tenantId: 't1', telefono: '8095551234', nombre: 'Ana', productoNombre: 'Yogurt', origen: 'WHATSAPP' });

      expect(prisma.lead.create).not.toHaveBeenCalled();
      expect(prisma.actividadCrm.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ leadId: 'l-existente', usuarioId: 'vendedor-asignado' }),
      });
    });

    it('sin nombre (null) usa el teléfono como nombre del Lead nuevo', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);
      prisma.lead.create.mockResolvedValue({ id: 'l1', vendedorId: null });

      await service.alConsultarProductoDesconocido({ tenantId: 't1', telefono: '8095551234', nombre: null, productoNombre: 'Yogurt', origen: 'WHATSAPP' });

      expect(prisma.lead.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ nombre: '8095551234' }) }));
    });

    it('sin ningún Admin Total en el tenant, no crea el Lead ni rompe', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.alConsultarProductoDesconocido({ tenantId: 't1', telefono: '8095551234', nombre: 'Ana', productoNombre: 'Yogurt', origen: 'WHATSAPP' }),
      ).resolves.not.toThrow();
      expect(prisma.lead.create).not.toHaveBeenCalled();
    });
  });
});
