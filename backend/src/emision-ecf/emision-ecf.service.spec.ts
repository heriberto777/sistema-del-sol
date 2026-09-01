import { NotFoundException } from '@nestjs/common';
import { EmisionECfService } from './emision-ecf.service';
import { AlanubeAdapter } from './alanube.adapter';
import { PlataformaConfigRepository } from '../plataforma-config/plataforma-config.repository';
import { PrismaService } from '../prisma/prisma.service';

describe('EmisionECfService', () => {
  let service: EmisionECfService;
  let alanubeAdapter: jest.Mocked<AlanubeAdapter>;
  let plataformaConfigRepository: jest.Mocked<PlataformaConfigRepository>;
  let prisma: {
    factura: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    ncfAsignado: { findFirst: jest.Mock };
    facturaPlataforma: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    ncfPlataforma: { findFirst: jest.Mock };
  };

  const FACTURA_BASE = {
    id: 'f1',
    tenantId: 't1',
    tipoNcf: 'E31',
    ncf: 'E310000000005',
    eCfEstado: null,
    total: 236,
    itbis: 36,
    cliente: { nombre: 'Cliente Demo', rncCedula: '131234567' },
    tenant: { nombre: 'Mi Empresa', rnc: '101000000', direccion: 'Calle 1' },
    lineas: [{ producto: { nombre: 'Producto A' }, descripcionManual: null, cantidad: 2, precioUnitario: 100, montoTotal: 200 }],
  };

  const FACTURA_PLATAFORMA_BASE = {
    id: 'fp1',
    tipoNcf: 'E31',
    ncf: 'E310000000009',
    eCfEstado: null,
    total: 1180,
    itbis: 180,
    monto: 1000,
    concepto: 'Suscripción Premium',
    tenant: { nombre: 'Tenant Demo', rnc: '131234567' },
    lineas: [],
  };

  beforeEach(() => {
    alanubeAdapter = { emitir: jest.fn(), consultarEstado: jest.fn() } as unknown as jest.Mocked<AlanubeAdapter>;
    plataformaConfigRepository = {
      obtenerOCrear: jest.fn().mockResolvedValue({ rnc: '101000000', direccion: 'Calle 1', nombreNegocio: 'Mi SaaS' }),
    } as unknown as jest.Mocked<PlataformaConfigRepository>;
    prisma = {
      factura: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      ncfAsignado: { findFirst: jest.fn().mockResolvedValue({ vigenciaHasta: new Date('2027-01-01') }) },
      facturaPlataforma: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      ncfPlataforma: { findFirst: jest.fn().mockResolvedValue({ vigenciaHasta: new Date('2027-01-01') }) },
    };
    service = new EmisionECfService(prisma as unknown as PrismaService, alanubeAdapter, plataformaConfigRepository);
  });

  describe('emitirParaFactura', () => {
    it('emite y guarda eCfEstado=EN_PROCESO + eCfIdExterno cuando todo está bien', async () => {
      prisma.factura.findUnique.mockResolvedValue(FACTURA_BASE);
      alanubeAdapter.emitir.mockResolvedValue({ idExterno: 'ulid-1' });

      await service.emitirParaFactura('t1', 'f1');

      expect(alanubeAdapter.emitir).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'E31', encf: 'E310000000005', montoTotal: 236, itbisTotal: 36 }),
      );
      expect(prisma.factura.update).toHaveBeenCalledWith({
        where: { id: 'f1' },
        data: { eCfEstado: 'EN_PROCESO', eCfIdExterno: 'ulid-1' },
      });
    });

    it('no hace nada si tipoNcf no es electrónico (B0x, NCF tradicional)', async () => {
      prisma.factura.findUnique.mockResolvedValue({ ...FACTURA_BASE, tipoNcf: 'B02' });

      await service.emitirParaFactura('t1', 'f1');

      expect(alanubeAdapter.emitir).not.toHaveBeenCalled();
    });

    it('no hace nada si la factura ya tiene eCfEstado (idempotencia)', async () => {
      prisma.factura.findUnique.mockResolvedValue({ ...FACTURA_BASE, eCfEstado: 'ACEPTADO' });

      await service.emitirParaFactura('t1', 'f1');

      expect(alanubeAdapter.emitir).not.toHaveBeenCalled();
    });

    it('no hace nada si la factura pertenece a otro tenant', async () => {
      prisma.factura.findUnique.mockResolvedValue({ ...FACTURA_BASE, tenantId: 'otro-tenant' });

      await service.emitirParaFactura('t1', 'f1');

      expect(alanubeAdapter.emitir).not.toHaveBeenCalled();
    });

    it('no llama al adaptador si el tenant no tiene RNC/dirección configurados', async () => {
      prisma.factura.findUnique.mockResolvedValue({ ...FACTURA_BASE, tenant: { nombre: 'Mi Empresa', rnc: null, direccion: null } });

      await service.emitirParaFactura('t1', 'f1');

      expect(alanubeAdapter.emitir).not.toHaveBeenCalled();
    });

    it('no revienta si el adaptador falla (sin token/red) — nunca bloquea la venta', async () => {
      prisma.factura.findUnique.mockResolvedValue(FACTURA_BASE);
      alanubeAdapter.emitir.mockRejectedValue(new Error('falta ALANUBE_API_TOKEN'));

      await expect(service.emitirParaFactura('t1', 'f1')).resolves.toBeUndefined();
      expect(prisma.factura.update).not.toHaveBeenCalled();
    });
  });

  describe('consultarEstado', () => {
    it('consulta a Alanube y persiste el estado actualizado', async () => {
      prisma.factura.findUniqueOrThrow.mockResolvedValue({ id: 'f1', tenantId: 't1', tipoNcf: 'E31', eCfIdExterno: 'ulid-1' });
      alanubeAdapter.consultarEstado.mockResolvedValue({ estado: 'ACEPTADO' });

      const resultado = await service.consultarEstado('t1', 'f1');

      expect(resultado.eCfEstado).toBe('ACEPTADO');
      expect(prisma.factura.update).toHaveBeenCalledWith({
        where: { id: 'f1' },
        data: { eCfEstado: 'ACEPTADO', eCfMensajeError: undefined },
      });
    });

    it('rechaza con 404 si la factura es de otro tenant', async () => {
      prisma.factura.findUniqueOrThrow.mockResolvedValue({ id: 'f1', tenantId: 'otro-tenant' });

      await expect(service.consultarEstado('t1', 'f1')).rejects.toThrow(NotFoundException);
    });

    it('devuelve el estado guardado sin llamar a Alanube si no hay eCfIdExterno', async () => {
      prisma.factura.findUniqueOrThrow.mockResolvedValue({ id: 'f1', tenantId: 't1', tipoNcf: 'E31', eCfIdExterno: null, eCfEstado: null, eCfMensajeError: null });

      const resultado = await service.consultarEstado('t1', 'f1');

      expect(alanubeAdapter.consultarEstado).not.toHaveBeenCalled();
      expect(resultado.eCfEstado).toBeNull();
    });
  });

  describe('emitirParaFacturaPlataforma', () => {
    it('emite y guarda eCfEstado=EN_PROCESO + eCfIdExterno cuando todo está bien', async () => {
      prisma.facturaPlataforma.findUnique.mockResolvedValue(FACTURA_PLATAFORMA_BASE);
      alanubeAdapter.emitir.mockResolvedValue({ idExterno: 'ulid-fp-1' });

      await service.emitirParaFacturaPlataforma('fp1');

      expect(alanubeAdapter.emitir).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'E31', encf: 'E310000000009', montoTotal: 1180, itbisTotal: 180 }),
      );
      expect(prisma.facturaPlataforma.update).toHaveBeenCalledWith({
        where: { id: 'fp1' },
        data: { eCfEstado: 'EN_PROCESO', eCfIdExterno: 'ulid-fp-1' },
      });
    });

    it('no hace nada si tipoNcf no es E31 (modalidad NCF tradicional de la plataforma)', async () => {
      prisma.facturaPlataforma.findUnique.mockResolvedValue({ ...FACTURA_PLATAFORMA_BASE, tipoNcf: 'B01' });

      await service.emitirParaFacturaPlataforma('fp1');

      expect(alanubeAdapter.emitir).not.toHaveBeenCalled();
    });

    it('no llama al adaptador si faltan datos de la empresa emisora en /plataforma/configuracion', async () => {
      plataformaConfigRepository.obtenerOCrear.mockResolvedValue({ rnc: null, direccion: null, nombreNegocio: null } as never);
      prisma.facturaPlataforma.findUnique.mockResolvedValue(FACTURA_PLATAFORMA_BASE);

      await service.emitirParaFacturaPlataforma('fp1');

      expect(alanubeAdapter.emitir).not.toHaveBeenCalled();
    });

    it('no revienta si el adaptador falla — nunca bloquea la generación de la factura', async () => {
      prisma.facturaPlataforma.findUnique.mockResolvedValue(FACTURA_PLATAFORMA_BASE);
      alanubeAdapter.emitir.mockRejectedValue(new Error('falta ALANUBE_API_TOKEN'));

      await expect(service.emitirParaFacturaPlataforma('fp1')).resolves.toBeUndefined();
      expect(prisma.facturaPlataforma.update).not.toHaveBeenCalled();
    });
  });

  describe('consultarEstadoPlataforma', () => {
    it('consulta a Alanube y persiste el estado actualizado', async () => {
      prisma.facturaPlataforma.findUniqueOrThrow.mockResolvedValue({ id: 'fp1', tipoNcf: 'E31', eCfIdExterno: 'ulid-fp-1' });
      alanubeAdapter.consultarEstado.mockResolvedValue({ estado: 'ACEPTADO' });

      const resultado = await service.consultarEstadoPlataforma('fp1');

      expect(resultado.eCfEstado).toBe('ACEPTADO');
      expect(alanubeAdapter.consultarEstado).toHaveBeenCalledWith('ulid-fp-1', 'E31');
    });
  });

  describe('actualizarPorWebhook', () => {
    it('actualiza la factura (tenant y plataforma) que tenga ese eCfIdExterno', async () => {
      await service.actualizarPorWebhook('ulid-1', 'ACEPTADO', undefined);

      expect(prisma.factura.updateMany).toHaveBeenCalledWith({
        where: { eCfIdExterno: 'ulid-1' },
        data: { eCfEstado: 'ACEPTADO', eCfMensajeError: undefined },
      });
      expect(prisma.facturaPlataforma.updateMany).toHaveBeenCalledWith({
        where: { eCfIdExterno: 'ulid-1' },
        data: { eCfEstado: 'ACEPTADO', eCfMensajeError: undefined },
      });
    });

    it('ignora un estado que no sea uno de los válidos', async () => {
      await service.actualizarPorWebhook('ulid-1', 'ALGO_RARO');

      expect(prisma.factura.updateMany).not.toHaveBeenCalled();
      expect(prisma.facturaPlataforma.updateMany).not.toHaveBeenCalled();
    });
  });
});
