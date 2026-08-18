import * as nodemailer from 'nodemailer';
import { EmailChannel } from './email.channel';

jest.mock('nodemailer');

describe('EmailChannel', () => {
  let channel: EmailChannel;
  let sendMailMock: jest.Mock;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    channel = new EmailChannel();
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
});
