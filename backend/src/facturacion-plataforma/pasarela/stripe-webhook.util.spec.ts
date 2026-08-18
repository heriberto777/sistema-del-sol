import { createHmac } from 'crypto';
import { verificarFirmaStripe } from './stripe-webhook.util';

const SECRET = 'whsec_test_secret';

function firmar(payload: string, timestamp: number, secret = SECRET): string {
  const firma = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${firma}`;
}

describe('verificarFirmaStripe', () => {
  it('acepta una firma válida y reciente', () => {
    const payload = '{"type":"checkout.session.completed"}';
    const header = firmar(payload, Math.floor(Date.now() / 1000));

    expect(verificarFirmaStripe(Buffer.from(payload), header, SECRET)).toBe(true);
  });

  it('rechaza si el secreto no coincide', () => {
    const payload = '{"type":"checkout.session.completed"}';
    const header = firmar(payload, Math.floor(Date.now() / 1000), 'otro_secreto');

    expect(verificarFirmaStripe(Buffer.from(payload), header, SECRET)).toBe(false);
  });

  it('rechaza si el payload fue alterado', () => {
    const header = firmar('{"monto":100}', Math.floor(Date.now() / 1000));

    expect(verificarFirmaStripe(Buffer.from('{"monto":999}'), header, SECRET)).toBe(false);
  });

  it('rechaza un timestamp fuera de la tolerancia (replay)', () => {
    const payload = '{"type":"checkout.session.completed"}';
    const timestampViejo = Math.floor(Date.now() / 1000) - 10_000;
    const header = firmar(payload, timestampViejo);

    expect(verificarFirmaStripe(Buffer.from(payload), header, SECRET)).toBe(false);
  });

  it('rechaza si falta el header', () => {
    expect(verificarFirmaStripe(Buffer.from('{}'), undefined, SECRET)).toBe(false);
  });

  it('rechaza un header malformado', () => {
    expect(verificarFirmaStripe(Buffer.from('{}'), 'esto-no-es-valido', SECRET)).toBe(false);
  });
});
