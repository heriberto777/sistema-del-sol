import { PasarelaPagoService } from './pasarela-pago.service';
import { StripeAdapter } from './stripe.adapter';
import { AzulAdapter } from './azul.adapter';
import { CardNetAdapter } from './cardnet.adapter';

describe('PasarelaPagoService', () => {
  let service: PasarelaPagoService;
  let stripeAdapter: StripeAdapter;
  let azulAdapter: AzulAdapter;
  let cardNetAdapter: CardNetAdapter;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    stripeAdapter = new StripeAdapter();
    azulAdapter = new AzulAdapter();
    cardNetAdapter = new CardNetAdapter();
    service = new PasarelaPagoService(stripeAdapter, azulAdapter, cardNetAdapter);
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  it('usa Stripe por defecto sin PASARELA_PAGO_ACTIVA', () => {
    delete process.env.PASARELA_PAGO_ACTIVA;
    expect(service.activa).toBe(stripeAdapter);
  });

  it('resuelve Azul cuando PASARELA_PAGO_ACTIVA=azul', () => {
    process.env.PASARELA_PAGO_ACTIVA = 'azul';
    expect(service.activa).toBe(azulAdapter);
  });

  it('resuelve CardNet cuando PASARELA_PAGO_ACTIVA=cardnet', () => {
    process.env.PASARELA_PAGO_ACTIVA = 'cardnet';
    expect(service.activa).toBe(cardNetAdapter);
  });

  it('cae a Stripe si el valor no es reconocido', () => {
    process.env.PASARELA_PAGO_ACTIVA = 'algo-inventado';
    expect(service.activa).toBe(stripeAdapter);
  });
});
