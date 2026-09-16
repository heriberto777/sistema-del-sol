import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappMensajesRepository } from './whatsapp-mensajes.repository';
import { verificarFirmaTwilio } from './twilio-signature.util';
import { ConversacionIaService } from '../ia/conversacion/conversacion-ia.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { descifrar } from '../common/utils/encriptado.util';
import { enviarWhatsappTwilio } from '../common/utils/twilio-whatsapp.util';
import { resolverOrigenPublicoWhatsapp } from '../common/utils/origen-publico-whatsapp.util';
import { construirCaptionProducto } from './construir-caption-producto.util';
import { fechaHoyRD } from '../common/utils/zona-horaria-rd.util';

const MENSAJE_LIMITE_ALCANZADO = 'Alcanzamos el límite de respuestas automáticas de hoy — un representante te va a contactar pronto.';
const MENSAJE_SIN_IA = 'El asistente automático no está disponible en este momento — un representante te va a contactar pronto.';
const MENSAJE_FALLBACK = 'Dejame conectarte con alguien del equipo, un momento por favor.';

/** Tope de fotos que manda el modo "catálogo por categoría" en un solo pedido — no es un catálogo completo, es una muestra. */
const MAX_PRODUCTOS_CATALOGO_CATEGORIA = 5;

const PROMPT_SCAFFOLDING = `Sos un asistente virtual de atención al cliente por WhatsApp.
Respondé ÚNICAMENTE con un JSON válido, sin texto adicional antes o después, con este formato exacto:
{"respuesta": "texto de tu respuesta al cliente", "requiereHumano": true o false, "buscarProducto": "texto o null", "buscarCategoria": "texto o null"}
Nunca inventes ni afirmes datos de facturas, pedidos, saldos o cuentas de clientes — no tenés acceso a esa información. Si te preguntan algo así, o el cliente pide hablar con una persona, o no podés resolver la consulta, marcá "requiereHumano": true y respondé que un representante lo va a contactar.
Si el cliente pregunta por UN producto puntual del catálogo (por nombre o palabra clave, pidiendo o no una foto), llená "buscarProducto" con esa palabra clave y dejá "buscarCategoria" en null — el sistema busca el producto y adjunta su foto aparte si lo encuentra, vos NO prometas la foto en tu texto (puede que no se encuentre).
Si el cliente pregunta por una CATEGORÍA o tipo de productos en general (no uno puntual — ej. "qué tienen de bebidas", "quiero ver ropa de niño"), llená "buscarCategoria" con esa categoría o palabra clave y dejá "buscarProducto" en null — el sistema manda varias fotos de esa categoría aparte, vos tampoco prometas las fotos en tu texto.
Si el cliente pide ver "el catálogo" o "qué tienen" en general, SIN mencionar un producto puntual ni una categoría, dejá los dos campos en null y tu "respuesta" debe preguntarle qué categoría o qué producto le interesa, en vez de asumir uno.
"buscarProducto" y "buscarCategoria" nunca van los dos con valor a la vez.`;

/**
 * Fase 1 del asistente interno (control de acceso por RBAC real, ver
 * `verificarPermisoConsultaInterna`) — hoy solo un dominio de datos
 * (tareas personales propias), pensado para sumar ventas/inventario/
 * balance de cliente más adelante sin rehacer la clasificación.
 */
const PROMPT_CLASIFICADOR_TAREAS = `Sos un clasificador de intención. Quien escribe es un EMPLEADO interno preguntando por sus propias tareas personales (no un cliente).
Respondé ÚNICAMENTE con una palabra en mayúsculas, sin comillas ni texto adicional:
HOY — si pregunta qué tiene que hacer hoy, o qué vence hoy.
PENDIENTES — si pregunta en general por sus tareas pendientes/atrasadas, sin especificar "hoy".
DESCONOCIDA — cualquier otra cosa (saludo, pregunta que no es sobre tareas, etc.).`;

const EMOJI_PRIORIDAD_TAREA: Record<string, string> = { ALTA: '🔴', MEDIA: '🟡', BAJA: '🟢' };

interface ConfigBot {
  tenantId: string;
  twilioAccountSid: string | null;
  twilioAuthTokenCifrado: string | null;
  twilioWhatsappFrom: string | null;
  /** ANTHROPIC/OPENAI/GEMINI — ver ConversacionIaService. Vacío/desconocido cae a Claude. */
  iaProveedor: string | null;
  iaModelo: string | null;
  iaApiKeyCifrado: string | null;
  iaPromptNegocio: string | null;
  historialMensajes: number;
  limiteRespuestasDiarias: number;
}

/**
 * Orquesta el bot conversacional de WhatsApp (ítem H-2b) — el webhook
 * (`WhatsappWebhookController`) solo parsea la petición y delega acá.
 */
@Injectable()
export class WhatsappBotService {
  private readonly logger = new Logger(WhatsappBotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappMensajesRepository: WhatsappMensajesRepository,
    private readonly conversacionIaService: ConversacionIaService,
    private readonly eventBus: EventBusService,
  ) {}

  /** `to` tal cual lo manda Twilio (prefijo `whatsapp:` incluido) — se normaliza acá antes de buscar. */
  async resolverConfigPorNumero(to: string) {
    const numero = to.replace(/^whatsapp:/, '');
    return this.prisma.whatsappConfigTenant.findUnique({ where: { twilioWhatsappFrom: numero } });
  }

  verificarFirma(config: { twilioAuthTokenCifrado: string | null }, urlCompleta: string, params: Record<string, string>, firma: string | undefined): boolean {
    if (!config.twilioAuthTokenCifrado) return false;
    return verificarFirmaTwilio(urlCompleta, params, firma, descifrar(config.twilioAuthTokenCifrado));
  }

  /**
   * Asistente interno (distinto del bot de atención al cliente de abajo)
   * — intercepta ANTES del flujo de cliente, mismo patrón que
   * `intentarAprobarPorWhatsapp` en el webhook. Si el número que escribe
   * coincide con un `User` activo de este tenant, responde sobre SUS
   * PROPIAS tareas en vez de correr el guion de atención al cliente; si
   * no, devuelve `false` sin ningún efecto secundario y el webhook sigue
   * el camino normal — un cliente cualquiera nunca llega a esta rama.
   *
   * A propósito NO pasa por `WhatsappMensajesRepository`/
   * `limiteRespuestasDiarias`: es tráfico interno de bajo volumen que no
   * debería gastarle cupo de respuestas automáticas al servicio al
   * cliente (decisión explícita del usuario), así que no se persiste en
   * `WhatsappMensaje` ni cuenta contra ningún tope — si en el futuro hace
   * falta auditoría de estas consultas, ese es el lugar para sumarla.
   *
   * Clasifica la intención con la MISMA IA que el tenant ya configuró
   * para su bot (nunca con la del Asistente general de Plataforma — este
   * código corre desde un webhook `@Public()`, sin `request.user`, y
   * `UsoIaService`/`TareasPersonalesRepository` dependen de
   * `TenantPrismaService`, que revienta sin ese contexto). Sin IA
   * configurada, cae a un matching simple por palabra clave — sigue
   * siendo útil, solo menos flexible con la redacción de la pregunta.
   */
  async intentarResponderComoEmpleado(config: ConfigBot, from: string, body: string): Promise<boolean> {
    const numero = from.replace(/^whatsapp:/, '');
    const empleado = await this.prisma.user.findFirst({
      where: { tenantId: config.tenantId, telefono: numero, activo: true },
      select: { id: true, nombre: true },
    });
    if (!empleado) return false;

    const intencion = await this.clasificarIntencionTareas(config, body);
    const respuesta = await this.responderIntencionTareas(config.tenantId, empleado, intencion);
    await this.enviarRespuesta(config, from, respuesta);
    return true;
  }

  private async clasificarIntencionTareas(config: ConfigBot, body: string): Promise<'HOY' | 'PENDIENTES' | 'DESCONOCIDA'> {
    if (config.iaApiKeyCifrado) {
      const texto = await this.conversacionIaService.completar(config.iaProveedor, [{ role: 'user', content: body }], {
        apiKey: descifrar(config.iaApiKeyCifrado),
        modelo: config.iaModelo ?? undefined,
        system: PROMPT_CLASIFICADOR_TAREAS,
        maxTokens: 20,
      });
      const limpio = texto?.trim().toUpperCase();
      if (limpio === 'HOY' || limpio === 'PENDIENTES' || limpio === 'DESCONOCIDA') return limpio;
      // Respuesta inesperada de la IA (texto de más, otro idioma) — no se
      // pierde el intento, cae al matching por palabra clave de abajo.
    }
    const texto = body.toLowerCase();
    if (texto.includes('hoy')) return 'HOY';
    if (texto.includes('pendiente') || texto.includes('tarea')) return 'PENDIENTES';
    return 'DESCONOCIDA';
  }

  /**
   * Nunca deja que la IA redacte un título o una fecha de la nada — acá
   * solo clasifica la intención (arriba), la lista real de tareas sale
   * SIEMPRE de una consulta directa a la base de datos, mismo criterio
   * que `buscarProducto`/`buscarCategoria` con el catálogo de clientes.
   */
  private async responderIntencionTareas(tenantId: string, empleado: { id: string; nombre: string }, intencion: 'HOY' | 'PENDIENTES' | 'DESCONOCIDA'): Promise<string> {
    if (intencion === 'DESCONOCIDA') {
      return 'Hola 👋 Puedo contarte tus tareas — probá preguntando "¿qué tengo hoy?" o "¿cuáles son mis pendientes?".';
    }

    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const inicioManana = new Date(inicioHoy);
    inicioManana.setDate(inicioManana.getDate() + 1);

    const tareas = await this.prisma.tareaPersonal.findMany({
      where: {
        tenantId,
        usuarioId: empleado.id,
        estado: { not: 'HECHA' },
        ...(intencion === 'HOY' ? { fecha: { gte: inicioHoy, lt: inicioManana } } : {}),
      },
      orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
      take: 10,
    });

    const primerNombre = empleado.nombre.split(' ')[0];
    if (tareas.length === 0) {
      return intencion === 'HOY' ? `No tenés tareas para hoy, ${primerNombre} 🎉` : `No tenés tareas pendientes, ${primerNombre} 🎉`;
    }

    const lineas = tareas
      .map((t) => {
        const fecha = t.fecha ? ` — ${new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: '2-digit' }).format(t.fecha)}` : '';
        return `${EMOJI_PRIORIDAD_TAREA[t.prioridad] ?? '•'} ${t.titulo}${fecha}`;
      })
      .join('\n');

    const titulo = intencion === 'HOY' ? '📋 *Tus tareas de hoy:*' : `📋 *Tus tareas pendientes (${tareas.length}):*`;
    return `${titulo}\n${lineas}`;
  }

  /** `from` tal cual lo manda Twilio (prefijo `whatsapp:` incluido) — es el remitente, el cliente. */
  async procesarMensajeEntrante(config: ConfigBot, from: string, body: string, perfilNombre: string | null = null) {
    const { tenantId } = config;
    const diaRD = fechaHoyRD();

    const mensajeEntrante = await this.whatsappMensajesRepository.crear({ tenantId, telefono: from, rol: 'USUARIO', contenido: body, perfilNombre, diaRD });

    const respuestasHoy = await this.whatsappMensajesRepository.contarRespuestasHoy(tenantId, diaRD);
    if (respuestasHoy >= config.limiteRespuestasDiarias) {
      await this.responderYEscalar(config, from, diaRD, mensajeEntrante.id, MENSAJE_LIMITE_ALCANZADO);
      return;
    }

    if (!config.iaApiKeyCifrado) {
      this.logger.warn(`Tenant ${tenantId} tiene el bot habilitado pero sin iaApiKeyCifrado configurada`);
      await this.responderYEscalar(config, from, diaRD, mensajeEntrante.id, MENSAJE_SIN_IA);
      return;
    }

    const historial = await this.whatsappMensajesRepository.historialReciente(tenantId, from, config.historialMensajes);
    const mensajes = [
      ...historial
        .filter((m) => m.id !== mensajeEntrante.id)
        .map((m) => ({ role: (m.rol === 'USUARIO' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.contenido })),
      { role: 'user' as const, content: body },
    ];

    const system = config.iaPromptNegocio
      ? `${PROMPT_SCAFFOLDING}\n\nInformación del negocio (provista por el negocio, no la inventes ni la contradigas):\n${config.iaPromptNegocio}`
      : PROMPT_SCAFFOLDING;

    const textoIa = await this.conversacionIaService.completar(config.iaProveedor, mensajes, {
      apiKey: descifrar(config.iaApiKeyCifrado),
      modelo: config.iaModelo ?? undefined,
      system,
    });

    const { respuesta, requiereHumano, buscarProducto, buscarCategoria } = this.parsearRespuestaIa(textoIa);

    await this.whatsappMensajesRepository.crear({ tenantId, telefono: from, rol: 'ASISTENTE', contenido: respuesta, diaRD });

    if (requiereHumano) {
      await this.marcarYNotificar(tenantId, mensajeEntrante.id, from);
    }

    await this.enviarRespuesta(config, from, respuesta);

    // Mutuamente excluyentes (ver PROMPT_SCAFFOLDING) — si la IA llenó los
    // dos igual por error, priorizamos el producto puntual.
    if (buscarProducto) {
      await this.intentarEnviarProducto(config, from, diaRD, buscarProducto);
    } else if (buscarCategoria) {
      await this.intentarEnviarCatalogoCategoria(config, from, diaRD, buscarCategoria);
    }
  }

  /**
   * Búsqueda de catálogo simple (no otra llamada a la IA, no cuenta contra
   * `limiteRespuestasDiarias`) — solo manda foto si hay EXACTAMENTE 1
   * coincidencia con imagen cargada (decisión confirmada con el usuario:
   * mejor no mandar nada a que se adivine mal). Cualquier otro caso (0,
   * 2+, o la única coincidencia sin foto) no hace nada, en silencio,
   * mismo criterio que el resto de este servicio con casos no accionables.
   */
  private async intentarEnviarProducto(config: ConfigBot, from: string, diaRD: string, textoBusqueda: string) {
    const origen = resolverOrigenPublicoWhatsapp();
    if (!origen || !this.tieneCredencialesTwilio(config)) return;

    const candidatos = await this.prisma.producto.findMany({
      where: {
        tenantId: config.tenantId,
        activo: true,
        OR: [{ nombre: { contains: textoBusqueda, mode: 'insensitive' } }, { codigo: { contains: textoBusqueda, mode: 'insensitive' } }],
      },
      select: this.selectProductoParaEnvio(),
      take: 2,
    });

    if (candidatos.length !== 1 || !candidatos[0].imagen) return;

    await this.enviarFotoProducto(config, from, diaRD, origen, candidatos[0]);
  }

  /**
   * Modo "catálogo por categoría" (decisión confirmada: solo manda varios
   * productos juntos cuando el cliente mencionó una categoría reconocible
   * — nunca ante un pedido genérico de "el catálogo", eso lo resuelve la
   * IA en su propio texto pidiendo que aclare). Mismo criterio de "no
   * adivinar" que `intentarEnviarProducto`: 0 o 2+ categorías coincidentes
   * → silencio. Manda hasta `MAX_PRODUCTOS_CATALOGO_CATEGORIA` fotos EN
   * SECUENCIA (no en paralelo) — si una falla, sigue con las demás en vez
   * de abortar el lote entero.
   */
  private async intentarEnviarCatalogoCategoria(config: ConfigBot, from: string, diaRD: string, textoCategoria: string) {
    const origen = resolverOrigenPublicoWhatsapp();
    if (!origen || !this.tieneCredencialesTwilio(config)) return;

    const categorias = await this.prisma.categoria.findMany({
      where: { tenantId: config.tenantId, activa: true, nombre: { contains: textoCategoria, mode: 'insensitive' } },
      select: { id: true },
      take: 2,
    });
    if (categorias.length !== 1) return;

    const productos = await this.prisma.producto.findMany({
      where: { tenantId: config.tenantId, activo: true, categoriaId: categorias[0].id, imagen: { not: null } },
      select: this.selectProductoParaEnvio(),
      orderBy: { nombre: 'asc' },
      take: MAX_PRODUCTOS_CATALOGO_CATEGORIA,
    });

    for (const producto of productos) {
      await this.enviarFotoProducto(config, from, diaRD, origen, producto);
    }
  }

  private selectProductoParaEnvio() {
    return {
      id: true,
      nombre: true,
      imagen: true,
      categoria: { select: { nombre: true } },
      descripcionTienda: true,
      variantes: {
        take: 1,
        orderBy: { createdAt: 'asc' as const },
        select: { precios: { where: { listaPrecio: 'GENERAL', vigenteHasta: null }, select: { precioVenta: true }, take: 1 } },
      },
    } as const;
  }

  private tieneCredencialesTwilio(config: ConfigBot): config is ConfigBot & { twilioAccountSid: string; twilioAuthTokenCifrado: string; twilioWhatsappFrom: string } {
    return Boolean(config.twilioAccountSid && config.twilioAuthTokenCifrado && config.twilioWhatsappFrom);
  }

  private async enviarFotoProducto(
    config: ConfigBot & { twilioAccountSid: string; twilioAuthTokenCifrado: string; twilioWhatsappFrom: string },
    from: string,
    diaRD: string,
    origen: string,
    producto: {
      id: string;
      nombre: string;
      imagen: string | null;
      categoria: { nombre: string } | null;
      descripcionTienda: string | null;
      variantes: { precios: { precioVenta: unknown }[] }[];
    },
  ) {
    const precio = producto.variantes[0]?.precios[0]?.precioVenta as string | number | null | undefined;
    const caption = construirCaptionProducto(producto, precio);
    const mediaUrl = `${origen}/api/public/productos/${producto.id}/imagen`;

    const enviado = await enviarWhatsappTwilio({
      accountSid: config.twilioAccountSid,
      authToken: descifrar(config.twilioAuthTokenCifrado),
      from: `whatsapp:${config.twilioWhatsappFrom}`,
      to: from.replace(/^whatsapp:/, ''),
      body: caption,
      mediaUrl,
    });
    if (!enviado) {
      this.logger.error(`Twilio respondió con error al mandar la foto de "${producto.nombre}" a ${from}`);
      return;
    }

    await this.whatsappMensajesRepository.crear({ tenantId: config.tenantId, telefono: from, rol: 'ASISTENTE', contenido: caption, diaRD });
  }

  private async responderYEscalar(config: ConfigBot, from: string, diaRD: string, mensajeEntranteId: string, mensaje: string) {
    await this.whatsappMensajesRepository.crear({ tenantId: config.tenantId, telefono: from, rol: 'ASISTENTE', contenido: mensaje, diaRD });
    await this.marcarYNotificar(config.tenantId, mensajeEntranteId, from);
    await this.enviarRespuesta(config, from, mensaje);
  }

  private async marcarYNotificar(tenantId: string, mensajeId: string, telefono: string) {
    await this.prisma.whatsappMensaje.update({ where: { id: mensajeId }, data: { requiereAtencionHumana: true } });
    this.eventBus.emit(EVENTOS.WHATSAPP_REQUIERE_ATENCION, { tenantId, mensajeId, telefono });
  }

  /** `to` (destinatario, el cliente) tal cual lo manda Twilio en `From` del webhook original — se le quita el prefijo acá, `enviarWhatsappTwilio` se lo vuelve a poner. */
  private async enviarRespuesta(config: ConfigBot, to: string, body: string) {
    if (!config.twilioAccountSid || !config.twilioAuthTokenCifrado || !config.twilioWhatsappFrom) {
      this.logger.error('No se pudo responder por WhatsApp — faltan credenciales de Twilio del tenant');
      return;
    }
    const enviado = await enviarWhatsappTwilio({
      accountSid: config.twilioAccountSid,
      authToken: descifrar(config.twilioAuthTokenCifrado),
      from: `whatsapp:${config.twilioWhatsappFrom}`,
      to: to.replace(/^whatsapp:/, ''),
      body,
    });
    if (!enviado) this.logger.error(`Twilio respondió con error al contestar a ${to}`);
  }

  private parsearRespuestaIa(
    texto: string | null,
  ): { respuesta: string; requiereHumano: boolean; buscarProducto: string | null; buscarCategoria: string | null } {
    if (!texto) return { respuesta: MENSAJE_FALLBACK, requiereHumano: true, buscarProducto: null, buscarCategoria: null };
    try {
      const parseado = JSON.parse(texto) as {
        respuesta?: unknown;
        requiereHumano?: unknown;
        buscarProducto?: unknown;
        buscarCategoria?: unknown;
      };
      if (typeof parseado.respuesta === 'string') {
        const buscarProducto = typeof parseado.buscarProducto === 'string' && parseado.buscarProducto.trim() ? parseado.buscarProducto.trim() : null;
        return {
          respuesta: parseado.respuesta,
          requiereHumano: Boolean(parseado.requiereHumano),
          buscarProducto,
          // Mutuamente excluyentes — si la IA llenó los dos, priorizamos buscarProducto (ver PROMPT_SCAFFOLDING).
          buscarCategoria:
            !buscarProducto && typeof parseado.buscarCategoria === 'string' && parseado.buscarCategoria.trim() ? parseado.buscarCategoria.trim() : null,
        };
      }
    } catch {
      // sigue al fallback de abajo
    }
    this.logger.warn('La IA no devolvió el JSON esperado — fail-safe a requiereHumano');
    return { respuesta: MENSAJE_FALLBACK, requiereHumano: true, buscarProducto: null, buscarCategoria: null };
  }
}
