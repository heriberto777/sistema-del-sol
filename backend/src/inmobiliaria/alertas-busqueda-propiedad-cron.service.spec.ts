import { AlertasBusquedaPropiedadCronService } from './alertas-busqueda-propiedad-cron.service';
import { EmailChannel } from '../notificaciones/canales/email.channel';

describe('AlertasBusquedaPropiedadCronService', () => {
  let service: AlertasBusquedaPropiedadCronService;
  let prisma: {
    alertaBusquedaPropiedad: { findMany: jest.Mock; update: jest.Mock };
    propiedad: { findMany: jest.Mock };
  };
  let emailChannel: jest.Mocked<EmailChannel>;

  const ALERTA_BASE = {
    id: 'al1',
    tenantId: 't1',
    email: 'visitante@example.com',
    operacion: null,
    tipo: null,
    ubicacion: null,
    precioMax: null,
    habitacionesMin: null,
    activa: true,
    ultimaNotificacionEn: null,
    createdAt: new Date('2026-01-01'),
    tenant: { subdominio: 'demo', nombre: 'Empresa Demo' },
  };

  beforeEach(() => {
    prisma = {
      alertaBusquedaPropiedad: { findMany: jest.fn(), update: jest.fn() },
      propiedad: { findMany: jest.fn() },
    };
    emailChannel = { enviar: jest.fn().mockResolvedValue(true) } as unknown as jest.Mocked<EmailChannel>;
    service = new AlertasBusquedaPropiedadCronService(prisma as never, emailChannel);
  });

  it('no envía nada si no hay propiedades nuevas que coincidan', async () => {
    prisma.alertaBusquedaPropiedad.findMany.mockResolvedValue([ALERTA_BASE]);
    prisma.propiedad.findMany.mockResolvedValue([]);

    await service.avisarNuevasCoincidencias();

    expect(emailChannel.enviar).not.toHaveBeenCalled();
    // Igual actualiza ultimaNotificacionEn — evita reconsultar desde el mismo `createdAt` por siempre.
    expect(prisma.alertaBusquedaPropiedad.update).toHaveBeenCalledWith({ where: { id: 'al1' }, data: { ultimaNotificacionEn: expect.any(Date) } });
  });

  it('envía un email por alerta con coincidencias, con el link a cada propiedad', async () => {
    prisma.alertaBusquedaPropiedad.findMany.mockResolvedValue([ALERTA_BASE]);
    prisma.propiedad.findMany.mockResolvedValue([{ id: 'p1', titulo: 'Apartamento en Piantini', precio: '195000', moneda: 'USD' }]);

    await service.avisarNuevasCoincidencias();

    expect(emailChannel.enviar).toHaveBeenCalledWith(
      'visitante@example.com',
      expect.stringContaining('Empresa Demo'),
      expect.stringContaining('/inmobiliaria/demo/p1'),
    );
  });

  it('busca desde ultimaNotificacionEn si ya se avisó antes (no desde createdAt de la alerta)', async () => {
    const ultimaNotificacionEn = new Date('2026-06-01');
    prisma.alertaBusquedaPropiedad.findMany.mockResolvedValue([{ ...ALERTA_BASE, ultimaNotificacionEn }]);
    prisma.propiedad.findMany.mockResolvedValue([]);

    await service.avisarNuevasCoincidencias();

    expect(prisma.propiedad.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ createdAt: { gt: ultimaNotificacionEn } }) }),
    );
  });

  it('filtra por los criterios guardados en la alerta (precioMax, tipo, etc.)', async () => {
    prisma.alertaBusquedaPropiedad.findMany.mockResolvedValue([{ ...ALERTA_BASE, tipo: 'APARTAMENTO', precioMax: 200000 }]);
    prisma.propiedad.findMany.mockResolvedValue([]);

    await service.avisarNuevasCoincidencias();

    expect(prisma.propiedad.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tipo: 'APARTAMENTO', precio: { lte: 200000 } }) }),
    );
  });
});
