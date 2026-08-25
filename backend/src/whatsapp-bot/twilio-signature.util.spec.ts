import { createHmac } from 'crypto';
import { verificarFirmaTwilio } from './twilio-signature.util';

const AUTH_TOKEN = 'auth-token-de-prueba';
const URL = 'https://api.example.com/webhooks/whatsapp/inbound';

function firmar(url: string, params: Record<string, string>, authToken = AUTH_TOKEN): string {
  const mensaje =
    url +
    Object.keys(params)
      .sort()
      .map((clave) => clave + params[clave])
      .join('');
  return createHmac('sha1', authToken).update(mensaje, 'utf8').digest('base64');
}

describe('verificarFirmaTwilio', () => {
  const params = { From: 'whatsapp:+18095551234', To: 'whatsapp:+14155238886', Body: 'hola' };

  it('acepta una firma válida', () => {
    const firma = firmar(URL, params);
    expect(verificarFirmaTwilio(URL, params, firma, AUTH_TOKEN)).toBe(true);
  });

  it('rechaza si el authToken no coincide', () => {
    const firma = firmar(URL, params, 'otro-token');
    expect(verificarFirmaTwilio(URL, params, firma, AUTH_TOKEN)).toBe(false);
  });

  it('rechaza si algún parámetro fue alterado', () => {
    const firma = firmar(URL, params);
    const alterado = { ...params, Body: 'mensaje distinto' };
    expect(verificarFirmaTwilio(URL, alterado, firma, AUTH_TOKEN)).toBe(false);
  });

  it('rechaza si la URL no coincide (webhook mal configurado o proxy distinto)', () => {
    const firma = firmar(URL, params);
    expect(verificarFirmaTwilio('https://otro-dominio.com/webhooks/whatsapp/inbound', params, firma, AUTH_TOKEN)).toBe(false);
  });

  it('rechaza si falta el header de firma', () => {
    expect(verificarFirmaTwilio(URL, params, undefined, AUTH_TOKEN)).toBe(false);
  });
});
