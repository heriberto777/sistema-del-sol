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
    cliente: { findFirst: jest.Mock };
    user: { findFirst: jest.Mock };
    actividadCrm: { create: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      // moduloEstaActivo() resuelve el Plan del tenant — se mockea completo para no acoplar el test a su implementación interna.
      modulo: { findUnique: jest.fn() },
      tenant: { findUnique: jest.fn() },
      lead: { findFirst: jest.fn(), create: jest.fn() },
      cliente: { findFirst: jest.fn().mockResolvedValue(null) },
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

  describe('alSugerirPedidoWhatsapp (CRM "Cotización conectada" Fase 3)', () => {
    const PEDIDO = {
      tenantId: 't1',
      telefono: '8095551234',
      nombre: 'Ana',
      lineas: [{ productoId: 'p1', nombre: 'Yogurt Fresa', cantidad: 2 }],
      textoOriginal: 'Quiero 2 yogurt fresa',
    };

    it('no hace nada si el módulo CRM no está activo para el tenant', async () => {
      mockCrmActivo(false);

      await service.alSugerirPedidoWhatsapp(PEDIDO);

      expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
    });

    describe('con CRM activo', () => {
      beforeEach(() => mockCrmActivo(true));

      it('si el teléfono ya es un Cliente real, cuelga la actividad de clienteId (no crea ni toca ningún Lead)', async () => {
        prisma.cliente.findFirst.mockResolvedValue({ id: 'cli-1' });

        await service.alSugerirPedidoWhatsapp(PEDIDO);

        expect(prisma.actividadCrm.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            tipo: 'TAREA',
            clienteId: 'cli-1',
            usuarioId: 'admin-1',
            lineasSugeridas: PEDIDO.lineas,
            descripcion: expect.stringContaining('2x Yogurt Fresa'),
          }),
        });
        expect(prisma.lead.findFirst).not.toHaveBeenCalled();
        expect(prisma.lead.create).not.toHaveBeenCalled();
      });

      it('si no es Cliente y no existe un Lead con ese teléfono, crea uno nuevo (origen WHATSAPP) y la actividad por leadId', async () => {
        prisma.lead.findFirst.mockResolvedValue(null);
        prisma.lead.create.mockResolvedValue({ id: 'l1', vendedorId: null });

        await service.alSugerirPedidoWhatsapp(PEDIDO);

        expect(prisma.lead.create).toHaveBeenCalledWith({
          data: { tenantId: 't1', nombre: 'Ana', telefono: '8095551234', origen: 'WHATSAPP' },
        });
        expect(prisma.actividadCrm.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ tipo: 'TAREA', leadId: 'l1', usuarioId: 'admin-1', lineasSugeridas: PEDIDO.lineas }),
        });
      });

      it('si no es Cliente pero ya existe un Lead con ese teléfono, lo reusa (y usa su vendedorId si lo tiene)', async () => {
        prisma.lead.findFirst.mockResolvedValue({ id: 'l-existente', vendedorId: 'vendedor-asignado' });

        await service.alSugerirPedidoWhatsapp(PEDIDO);

        expect(prisma.lead.create).not.toHaveBeenCalled();
        expect(prisma.actividadCrm.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ leadId: 'l-existente', usuarioId: 'vendedor-asignado' }),
        });
      });

      it('sin ningún Admin Total en el tenant y sin Lead existente, no crea nada ni rompe', async () => {
        prisma.lead.findFirst.mockResolvedValue(null);
        prisma.user.findFirst.mockResolvedValue(null);

        await expect(service.alSugerirPedidoWhatsapp(PEDIDO)).resolves.not.toThrow();
        expect(prisma.lead.create).not.toHaveBeenCalled();
        expect(prisma.actividadCrm.create).not.toHaveBeenCalled();
      });
    });
  });
});
