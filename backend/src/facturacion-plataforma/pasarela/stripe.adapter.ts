import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { CrearSesionPagoParams, PasarelaPagoAdapter, SesionPagoResultado } from './pasarela-pago.interface';

/**
 * `fetch` nativo directo contra la REST API de Stripe — mismo criterio
 * que IaClientService con Anthropic: es un solo POST, no justifica
 * agregar el SDK oficial `stripe` como dependencia nueva. Sin
 * STRIPE_SECRET_KEY, degrada con un error claro en vez de crashear
 * (mismo patrón: nunca llama a `fetch` sin la credencial).
 */
@Injectable()
export class StripeAdapter implements PasarelaPagoAdapter {
  private readonly logger = new Logger(StripeAdapter.name);
  readonly clave = 'stripe';

  get habilitado(): boolean {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  }

  async crearSesionPago(params: CrearSesionPagoParams): Promise<SesionPagoResultado> {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new ServiceUnavailableException('Pagos en línea no están disponibles todavía (falta STRIPE_SECRET_KEY)');
    }

    const currency = process.env.STRIPE_CURRENCY || 'usd';
    const body = new URLSearchParams();
    body.set('mode', 'payment');
    body.set('success_url', params.successUrl);
    body.set('cancel_url', params.cancelUrl);
    body.set('client_reference_id', params.facturaId);
    body.set('metadata[facturaId]', params.facturaId);
    body.set('line_items[0][quantity]', '1');
    body.set('line_items[0][price_data][currency]', currency);
    body.set('line_items[0][price_data][unit_amount]', String(Math.round(params.montoPendiente * 100)));
    body.set('line_items[0][price_data][product_data][name]', params.concepto);

    let respuesta: Response;
    try {
      respuesta = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (error) {
      this.logger.error('Fallo al llamar a la API de Stripe', error as Error);
      throw new ServiceUnavailableException('No se pudo contactar a Stripe — intenta de nuevo en unos minutos');
    }

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      this.logger.error(`Stripe respondió ${respuesta.status} al crear la sesión de pago: ${detalle}`);
      throw new ServiceUnavailableException('Stripe no pudo crear la sesión de pago');
    }

    const sesion = (await respuesta.json()) as { id: string; url: string };
    return { url: sesion.url, referenciaExterna: sesion.id };
  }
}
