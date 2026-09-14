import * as nodemailer from 'nodemailer';
import { EmailChannel } from './email.channel';
import { PrismaService } from '../../prisma/prisma.service';
import { cifrar } from '../../common/utils/encriptado.util';

jest.mock('nodemailer');

describe('EmailChannel', () => {
  let channel: EmailChannel;
  let prisma: { emailConfigTenant: { findUnique: jest.Mock } };
  let sendMailMock: jest.Mock;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'clave-de-prueba';
    prisma = { emailConfigTenant: { findUnique: jest.fn().mockResolvedValue(null) } };
    channel = new EmailChannel(prisma as unknown as PrismaService);
    sendMailMock = jest.fn().mockResolvedValue(true);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: sendMailMock });
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
    jest.clearAllMocks();
  });

  it('no envía (y no arma transporter) si EMAIL_HABILITADO no es "true"', async () => {
    delete process.env.EMAIL_HABILITADO;

    const resultado = await channel.enviar('cliente@ejemplo.com', 'asunto', 'cuerpo');

    expect(resultado).toBe(false);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('arma el transporter con los valores vigentes de process.env en cada envío', async () => {
    process.env.EMAIL_HABILITADO = 'true';
    process.env.SMTP_HOST = 'smtp.ejemplo.com';
    process.env.SMTP_PORT = '2525';
    process.env.SMTP_USER = 'usuario';
    process.env.SMTP_PASSWORD = 'clave';
    process.env.SMTP_FROM = 'no-reply@ejemplo.com';

    const resultado = await channel.enviar('cliente@ejemplo.com', 'Asunto', '<p>cuerpo</p>');

    expect(resultado).toBe(true);
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.ejemplo.com',
      port: 2525,
      auth: { user: 'usuario', pass: 'clave' },
    });
    expect(sendMailMock).toHaveBeenCalledWith({
      from: 'no-reply@ejemplo.com',
      to: 'cliente@ejemplo.com',
      subject: 'Asunto',
      html: '<p>cuerpo</p>',
    });
  });

  it('recoge un cambio de SMTP_HOST entre dos envíos sin reiniciar (arma transporter nuevo cada vez)', async () => {
    process.env.EMAIL_HABILITADO = 'true';
    process.env.SMTP_HOST = 'smtp-viejo.ejemplo.com';

    await channel.enviar('a@ejemplo.com', 'x', 'y');
    process.env.SMTP_HOST = 'smtp-nuevo.ejemplo.com';
    await channel.enviar('b@ejemplo.com', 'x', 'y');

    expect((nodemailer.createTransport as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({ host: 'smtp-viejo.ejemplo.com' }),
    );
    expect((nodemailer.createTransport as jest.Mock).mock.calls[1][0]).toEqual(
      expect.objectContaining({ host: 'smtp-nuevo.ejemplo.com' }),
    );
  });

  it('devuelve false si el envío falla', async () => {
    process.env.EMAIL_HABILITADO = 'true';
    sendMailMock.mockRejectedValue(new Error('ECONNRESET'));

    const resultado = await channel.enviar('cliente@ejemplo.com', 'asunto', 'cuerpo');

    expect(resultado).toBe(false);
  });

  describe('SMTP propio del tenant', () => {
    it('usa el SMTP del tenant cuando está habilitado y con host, en vez del de plataforma', async () => {
      process.env.EMAIL_HABILITADO = 'true';
      process.env.SMTP_HOST = 'smtp-plataforma.ejemplo.com';
      prisma.emailConfigTenant.findUnique.mockResolvedValue({
        habilitado: true,
        smtpHost: 'smtp-tenant.ejemplo.com',
        smtpPort: 465,
        smtpUser: 'ventas@tenant.com',
        smtpPasswordCifrado: cifrar('clave_tenant'),
        smtpFrom: 'ventas@tenant.com',
      });

      const resultado = await channel.enviar('cliente@ejemplo.com', 'Asunto', 'cuerpo', undefined, 't1');

      expect(resultado).toBe(true);
      expect(prisma.emailConfigTenant.findUnique).toHaveBeenCalledWith({ where: { tenantId: 't1' } });
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp-tenant.ejemplo.com',
        port: 465,
        auth: { user: 'ventas@tenant.com', pass: 'clave_tenant' },
      });
      expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ from: 'ventas@tenant.com' }));
    });

    it('cae al SMTP de plataforma si el tenant no tiene uno propio configurado', async () => {
      process.env.EMAIL_HABILITADO = 'true';
      process.env.SMTP_HOST = 'smtp-plataforma.ejemplo.com';
      prisma.emailConfigTenant.findUnique.mockResolvedValue(null);

      await channel.enviar('cliente@ejemplo.com', 'Asunto', 'cuerpo', undefined, 't1');

      expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: 'smtp-plataforma.ejemplo.com' }));
    });

    it('cae al SMTP de plataforma si el tenant lo tiene deshabilitado', async () => {
      process.env.EMAIL_HABILITADO = 'true';
      process.env.SMTP_HOST = 'smtp-plataforma.ejemplo.com';
      prisma.emailConfigTenant.findUnique.mockResolvedValue({ habilitado: false, smtpHost: 'smtp-tenant.ejemplo.com' });

      await channel.enviar('cliente@ejemplo.com', 'Asunto', 'cuerpo', undefined, 't1');

      expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: 'smtp-plataforma.ejemplo.com' }));
    });

    it('no falla ni consulta la config del tenant si no se pasa tenantId (envíos de Plataforma)', async () => {
      process.env.EMAIL_HABILITADO = 'true';
      process.env.SMTP_HOST = 'smtp-plataforma.ejemplo.com';

      await channel.enviar('admin@tenant.com', 'Asunto', 'cuerpo');

      expect(prisma.emailConfigTenant.findUnique).not.toHaveBeenCalled();
      expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: 'smtp-plataforma.ejemplo.com' }));
    });

    it('si el SMTP del tenant falla, NO reintenta con el de plataforma (sin fallback ante error)', async () => {
      process.env.EMAIL_HABILITADO = 'true';
      process.env.SMTP_HOST = 'smtp-plataforma.ejemplo.com';
      prisma.emailConfigTenant.findUnique.mockResolvedValue({ habilitado: true, smtpHost: 'smtp-tenant.ejemplo.com' });
      sendMailMock.mockRejectedValue(new Error('ECONNREFUSED'));

      const resultado = await channel.enviar('cliente@ejemplo.com', 'Asunto', 'cuerpo', undefined, 't1');

      expect(resultado).toBe(false);
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    });
  });
});
