import { Injectable } from '@nestjs/common';
import { StripeAdapter } from './stripe.adapter';
import { AzulAdapter } from './azul.adapter';
import { CardNetAdapter } from './cardnet.adapter';
import { PasarelaPagoAdapter } from './pasarela-pago.interface';

/** Único punto que sabe qué pasarela está activa (PASARELA_PAGO_ACTIVA) — todo lo demás solo conoce PasarelaPagoAdapter. */
@Injectable()
export class PasarelaPagoService {
  constructor(
    private readonly stripeAdapter: StripeAdapter,
    private readonly azulAdapter: AzulAdapter,
    private readonly cardNetAdapter: CardNetAdapter,
  ) {}

  get activa(): PasarelaPagoAdapter {
    const clave = process.env.PASARELA_PAGO_ACTIVA || 'stripe';
    const adaptadores: Record<string, PasarelaPagoAdapter> = {
      stripe: this.stripeAdapter,
      azul: this.azulAdapter,
      cardnet: this.cardNetAdapter,
    };
    return adaptadores[clave] ?? this.stripeAdapter;
  }
}
