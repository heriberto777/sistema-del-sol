import { createHmac } from 'crypto';
import { verificarFirmaDuffel } from './duffel-webhook.util';

const SECRET = 'duffel_webhook_secret_test';

function firmar(payload: string, timestamp: number, secret = SECRET): string {
  const firma = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${firma}`;
}

describe('verificarFirmaDuffel', () => {
  it('acepta una firma válida y reciente', () => {
    const payload = '{"type":"order.airline_initiated_change_detected"}';
    const header = firmar(payload, Math.floor(Date.now() / 1000));

    expect(verificarFirmaDuffel(Buffer.from(payload), header, SECRET)).toBe(true);
  });

  it('rechaza si el secreto no coincide', () => {
    const payload = '{"type":"order.airline_initiated_change_detected"}';
    const header = firmar(payload, Math.floor(Date.now() / 1000), 'otro_secreto');

    expect(verificarFirmaDuffel(Buffer.from(payload), header, SECRET)).toBe(false);
  });

  it('rechaza si el payload fue alterado', () => {
    const header = firmar('{"order_id":"ord_1"}', Math.floor(Date.now() / 1000));

    expect(verificarFirmaDuffel(Buffer.from('{"order_id":"ord_2"}'), header, SECRET)).toBe(false);
  });

  it('rechaza un timestamp fuera de la tolerancia (replay)', () => {
    const payload = '{"type":"order_cancellation.created"}';
    const timestampViejo = Math.floor(Date.now() / 1000) - 10_000;
    const header = firmar(payload, timestampViejo);

    expect(verificarFirmaDuffel(Buffer.from(payload), header, SECRET)).toBe(false);
  });

  it('rechaza si falta el header', () => {
    expect(verificarFirmaDuffel(Buffer.from('{}'), undefined, SECRET)).toBe(false);
  });

  it('rechaza un header malformado', () => {
    expect(verificarFirmaDuffel(Buffer.from('{}'), 'esto-no-es-valido', SECRET)).toBe(false);
  });
});
