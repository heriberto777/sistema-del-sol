import { enviarWhatsappTwilio } from './twilio-whatsapp.util';

describe('enviarWhatsappTwilio', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;
  });

  it('manda Body cuando no viene contentSid (camino de siempre)', async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await enviarWhatsappTwilio({ accountSid: 'AC1', authToken: 'tok', from: 'whatsapp:+1', to: '+18095551234', body: 'hola' });

    const [, opciones] = fetchMock.mock.calls[0];
    const body = opciones.body as URLSearchParams;
    expect(body.get('Body')).toBe('hola');
    expect(body.get('ContentSid')).toBeNull();
  });

  it('Fase 5 — manda ContentSid + ContentVariables (JSON) en vez de Body cuando viene contentSid', async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await enviarWhatsappTwilio({
      accountSid: 'AC1',
      authToken: 'tok',
      from: 'whatsapp:+1',
      to: '+18095551234',
      contentSid: 'HXabc123',
      contentVariables: { '1': 'Yogurt Fresa', '2': 'https://app/publicaciones/p1' },
    });

    const [, opciones] = fetchMock.mock.calls[0];
    const body = opciones.body as URLSearchParams;
    expect(body.get('ContentSid')).toBe('HXabc123');
    expect(body.get('ContentVariables')).toBe(JSON.stringify({ '1': 'Yogurt Fresa', '2': 'https://app/publicaciones/p1' }));
    expect(body.get('Body')).toBeNull();
  });

  it('agrega MediaUrl cuando viene, sin importar el camino', async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await enviarWhatsappTwilio({
      accountSid: 'AC1',
      authToken: 'tok',
      from: 'whatsapp:+1',
      to: '+18095551234',
      contentSid: 'HXabc123',
      mediaUrl: 'https://ejemplo.com/foto.png',
    });

    const [, opciones] = fetchMock.mock.calls[0];
    const body = opciones.body as URLSearchParams;
    expect(body.get('MediaUrl')).toBe('https://ejemplo.com/foto.png');
  });
});
