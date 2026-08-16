import { WhatsAppChannel } from './whatsapp.channel';

describe('WhatsAppChannel', () => {
  let channel: WhatsAppChannel;
  let fetchMock: jest.Mock;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    channel = new WhatsAppChannel();
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
    jest.restoreAllMocks();
  });

  it('no envía (y no revienta) si faltan las credenciales de Twilio', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_WHATSAPP_FROM;

    const resultado = await channel.enviar('+18095551234', 'asunto', 'cuerpo');

    expect(resultado).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('llama a la API de Twilio con Basic Auth y el prefijo whatsapp: en To/From', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACxxx';
    process.env.TWILIO_AUTH_TOKEN = 'token-secreto';
    process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886';
    fetchMock.mockResolvedValue({ ok: true, status: 201 });

    const resultado = await channel.enviar('+18095551234', 'asunto', 'Tu factura fue emitida');

    expect(resultado).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.twilio.com/2010-04-01/Accounts/ACxxx/Messages.json',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('ACxxx:token-secreto').toString('base64')}`,
        }),
      }),
    );
    const [, opciones] = fetchMock.mock.calls[0];
    const body = opciones.body as URLSearchParams;
    expect(body.get('To')).toBe('whatsapp:+18095551234');
    expect(body.get('From')).toBe('whatsapp:+14155238886');
    expect(body.get('Body')).toBe('Tu factura fue emitida');
  });

  it('devuelve false si Twilio responde con error', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACxxx';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886';
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    const resultado = await channel.enviar('+18095551234', 'asunto', 'cuerpo');

    expect(resultado).toBe(false);
  });

  it('devuelve false si la petición falla (red caída, etc.)', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACxxx';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886';
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    const resultado = await channel.enviar('+18095551234', 'asunto', 'cuerpo');

    expect(resultado).toBe(false);
  });
});
