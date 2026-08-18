import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { randomBytes, createHmac } from 'crypto';
import type { Webhook } from '@prisma/client';
import { WebhooksRepository } from './webhooks.repository';
import { validarUrlWebhook } from './ssrf-guard';
import { CrearWebhookDto } from './dto/crear-webhook.dto';
import { EVENTOS } from '../event-bus/events';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

const MAX_INTENTOS = 3;
// Sin espera en el primer intento; backoff creciente en los reintentos.
const RETRASOS_MS = [0, 2000, 8000];

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly webhooksRepository: WebhooksRepository) {}

  async crear(dto: CrearWebhookDto, tenantId: string) {
    // `validarUrlWebhook` lanza Error (no HttpException) — incluyendo un
    // TypeError crudo de `new URL()` si la URL ni siquiera parsea — así que
    // sin este catch, cualquier URL inválida o que apunte a una IP privada
    // terminaba como 500 en vez de un 400 claro para el usuario.
    try {
      await validarUrlWebhook(dto.url);
    } catch (error) {
      throw new BadRequestException((error as Error).message || 'URL de webhook inválida');
    }
    const secret = randomBytes(32).toString('hex');
    return this.webhooksRepository.crear(dto.url, dto.eventos, secret, tenantId);
  }

  listar() {
    return this.webhooksRepository.listar();
  }

  eliminar(id: string) {
    return this.webhooksRepository.eliminar(id);
  }

  /** `buscarPorId` valida que el webhook pertenezca al tenant (404 si no) antes de listar sus entregas. */
  async listarEntregas(id: string, query: ListadoQueryDto) {
    await this.webhooksRepository.buscarPorId(id);
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.webhooksRepository.listarEntregas(id, { skip, take });
    return { datos, total, pagina, tamanoPagina };
  }

  private async despachar(evento: string, payload: { tenantId: string } & Record<string, unknown>) {
    const webhooks = await this.webhooksRepository.buscarActivosPorEvento(payload.tenantId, evento);

    await Promise.all(
      webhooks.map(async (webhook) => {
        const cuerpo = JSON.stringify({ evento, payload, timestamp: new Date().toISOString() });
        const firma = createHmac('sha256', webhook.secret).update(cuerpo).digest('hex');

        const { statusCode, exitoso, intentos } = await this.intentarEntrega(webhook, evento, cuerpo, firma);
        await this.webhooksRepository.registrarEntrega(webhook.id, evento, payload, statusCode, exitoso, intentos);
      }),
    );
  }

  /** Reintenta con backoff creciente antes de registrar el fallo definitivo. */
  private async intentarEntrega(webhook: Webhook, evento: string, cuerpo: string, firma: string) {
    let statusCode: number | null = null;

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      if (RETRASOS_MS[intento - 1]) await esperar(RETRASOS_MS[intento - 1]);

      // Revalidar en CADA intento, no solo al crear el webhook: `validarUrlWebhook`
      // en crear() resuelve el host una sola vez; si el atacante registra un
      // dominio con una IP pública y luego cambia el DNS a una IP privada
      // (DNS rebinding), la entrega original nunca se re-chequeaba y el fetch
      // de abajo terminaba pegándole a infraestructura interna. Esto reduce
      // la ventana de ataque a "el DNS debe resolver a una IP mala en el
      // instante exacto de esta línea" — no la cierra del todo (un DNS con
      // TTL=0 controlado por el atacante podría, en teoría, devolver una IP
      // distinta entre esta validación y el fetch inmediatamente después);
      // cerrarla por completo requeriría fijar la IP ya resuelta en la
      // conexión TCP del fetch, que no se implementó aquí.
      try {
        await validarUrlWebhook(webhook.url);
      } catch (error) {
        this.logger.error(`Webhook ${webhook.id} (${evento}) bloqueado por el SSRF guard al momento de entregar: ${(error as Error).message}`);
        return { statusCode: null, exitoso: false, intentos: intento };
      }

      try {
        const respuesta = await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Sol-Signature': firma },
          body: cuerpo,
          signal: AbortSignal.timeout(5000),
        });
        statusCode = respuesta.status;
        if (respuesta.ok) return { statusCode, exitoso: true, intentos: intento };
        this.logger.warn(`Webhook ${webhook.id} (${evento}) respondió ${respuesta.status} en el intento ${intento}/${MAX_INTENTOS}`);
      } catch (error) {
        this.logger.warn(`Webhook ${webhook.id} (${evento}) falló en el intento ${intento}/${MAX_INTENTOS}: ${(error as Error).message}`);
      }
    }

    this.logger.error(`Webhook ${webhook.id} (${evento}) agotó los ${MAX_INTENTOS} intentos sin éxito`);
    return { statusCode, exitoso: false, intentos: MAX_INTENTOS };
  }

  @OnEvent(EVENTOS.FACTURA_CREADA)
  alFacturarse(payload: { tenantId: string }) {
    return this.despachar(EVENTOS.FACTURA_CREADA, payload);
  }

  @OnEvent(EVENTOS.FACTURA_ANULADA)
  alAnularse(payload: { tenantId: string }) {
    return this.despachar(EVENTOS.FACTURA_ANULADA, payload);
  }

  @OnEvent(EVENTOS.STOCK_BAJO)
  alBajarStock(payload: { tenantId: string }) {
    return this.despachar(EVENTOS.STOCK_BAJO, payload);
  }

  @OnEvent(EVENTOS.ORDEN_COMPRA_RECIBIDA)
  alRecibirCompra(payload: { tenantId: string }) {
    return this.despachar(EVENTOS.ORDEN_COMPRA_RECIBIDA, payload);
  }

  @OnEvent(EVENTOS.CLIENTE_CREADO)
  alCrearCliente(payload: { tenantId: string }) {
    return this.despachar(EVENTOS.CLIENTE_CREADO, payload);
  }
}
