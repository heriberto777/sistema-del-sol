import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { EmisorECfAdapter, EmitirECfParams, EmitirECfResultado, EstadoECfResultado, TipoDocumentoECf } from './emisor-ecf-adapter.interface';

const BASE_URL: Record<'sandbox' | 'produccion', string> = {
  sandbox: 'https://sandbox.alanube.co/dom/v1',
  produccion: 'https://api.alanube.co/dom/v1',
};

/** Un endpoint de creación/consulta por tipo de e-CF — ver developer.alanube.co/llms.txt. */
const RUTA_POR_TIPO: Record<TipoDocumentoECf, string> = {
  E31: 'fiscal-invoices',
  E32: 'invoices',
  E33: 'debit-notes',
  E34: 'credit-notes',
};

/**
 * `fetch` nativo directo contra la API REST de Alanube (PSFE certificado
 * por la DGII) — mismo criterio que StripeAdapter/IaClientService: sin
 * SDK oficial, un puñado de llamadas REST no lo justifica. Sin
 * `ALANUBE_API_TOKEN` degrada con un error claro, nunca llama a `fetch`.
 *
 * `incomeType`/`paymentType` (catálogo DGII) van con el default más
 * común (Ingresos por Operaciones / Contado o Crédito según el
 * documento) — sin verificar contra el catálogo oficial completo de la
 * DGII en tiempo real, mismo criterio de cautela ya documentado para
 * las tasas de Nómina (TSS/ISR): confirmar antes de emitir en
 * producción real.
 */
@Injectable()
export class AlanubeAdapter implements EmisorECfAdapter {
  private readonly logger = new Logger(AlanubeAdapter.name);

  get habilitado(): boolean {
    return Boolean(process.env.ALANUBE_API_TOKEN);
  }

  private get baseUrl(): string {
    const ambiente = process.env.ALANUBE_AMBIENTE === 'produccion' ? 'produccion' : 'sandbox';
    return BASE_URL[ambiente];
  }

  async emitir(params: EmitirECfParams): Promise<EmitirECfResultado> {
    const token = process.env.ALANUBE_API_TOKEN;
    if (!token) {
      throw new ServiceUnavailableException('Emisión de e-CF no disponible todavía (falta ALANUBE_API_TOKEN)');
    }

    const ruta = RUTA_POR_TIPO[params.tipo];
    const body = {
      idDoc: {
        encf: params.encf,
        sequenceDueDate: params.fechaVencimientoSecuencia.toISOString().slice(0, 10),
        incomeType: 1,
        paymentType: 1,
      },
      sender: {
        rnc: params.emisor.rnc,
        companyName: params.emisor.razonSocial,
        address: params.emisor.direccion,
        stampDate: new Date().toISOString().slice(0, 10),
      },
      buyer: {
        rnc: params.receptor.rnc,
        companyName: params.receptor.razonSocial,
      },
      totals: {
        totalAmount: params.montoTotal,
        itbisTotal: params.itbisTotal,
      },
      itemDetails: params.lineas.map((l) => ({
        lineNumber: l.numero,
        billingIndicator: 1,
        itemName: l.descripcion,
        goodServiceIndicator: 1,
        quantityItem: l.cantidad,
        unitPriceItem: l.precioUnitario,
        itemAmount: l.montoTotal,
      })),
    };

    let respuesta: Response;
    try {
      respuesta = await fetch(`${this.baseUrl}/${ruta}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      this.logger.error('Fallo al llamar a la API de Alanube', error as Error);
      throw new ServiceUnavailableException('No se pudo contactar a Alanube — intenta de nuevo en unos minutos');
    }

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      this.logger.error(`Alanube respondió ${respuesta.status} al emitir ${params.tipo}: ${detalle}`);
      throw new ServiceUnavailableException('Alanube no pudo emitir el comprobante electrónico');
    }

    const datos = (await respuesta.json()) as { id: string };
    return { idExterno: datos.id };
  }

  async consultarEstado(idExterno: string, tipo: TipoDocumentoECf): Promise<EstadoECfResultado> {
    const token = process.env.ALANUBE_API_TOKEN;
    if (!token) {
      throw new ServiceUnavailableException('Consulta de e-CF no disponible todavía (falta ALANUBE_API_TOKEN)');
    }

    const ruta = RUTA_POR_TIPO[tipo];
    let respuesta: Response;
    try {
      respuesta = await fetch(`${this.baseUrl}/${ruta}/${idExterno}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      this.logger.error('Fallo al consultar el estado en Alanube', error as Error);
      throw new ServiceUnavailableException('No se pudo contactar a Alanube — intenta de nuevo en unos minutos');
    }

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      this.logger.error(`Alanube respondió ${respuesta.status} al consultar ${idExterno}: ${detalle}`);
      throw new ServiceUnavailableException('Alanube no pudo devolver el estado del comprobante');
    }

    const datos = (await respuesta.json()) as { status?: string; message?: string };
    const ESTADOS: Record<string, EstadoECfResultado['estado']> = {
      accepted: 'ACEPTADO',
      conditionally_accepted: 'ACEPTADO_CONDICIONAL',
      rejected: 'RECHAZADO',
    };
    return { estado: ESTADOS[datos.status ?? ''] ?? 'EN_PROCESO', mensaje: datos.message };
  }
}
