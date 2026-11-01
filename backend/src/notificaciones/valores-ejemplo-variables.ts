/**
 * Valores de muestra para la Vista previa de una plantilla (Admin →
 * Notificaciones) — el admin edita texto con variables sin disparar un
 * envío real, así que hace falta algo razonable para reemplazar cada
 * `{{variable}}` y poder renderizar el sobre HTML tal cual se vería.
 * Nunca se usa en un envío real (eso sigue viniendo de `params.variables`
 * en NotificacionesService.enviar()).
 */
const EJEMPLOS_POR_NOMBRE: Record<string, string> = {
  cliente_nombre: 'Juana Pérez',
  factura_total: '4,500.00',
  factura_ncf: 'B0100000123',
  factura_fecha: '01/11/2026',
  cotizacion_numero: 'COT-00045',
  cotizacion_total: '12,300.00',
  link: 'https://app.sistemadelsol.com/ver-factura/ejemplo',
  motivo: ': el cliente eligió otro proveedor',
  motivo_rechazo: 'La foto sale borrosa',
  telefono: '+1 809 555 1234',
  producto_id: 'PROD-001',
  producto_nombre: 'Yogurt de fresa',
  cantidad_actual: '3',
  stock_minimo: '10',
  numero_lote: 'L-2026-08',
  fecha_vencimiento: '15/12/2026',
  hito_nombre: 'Entrega de planos',
  proyecto_nombre: 'Remodelación Oficina Central',
  fecha_objetivo: '20/11/2026',
  presupuesto: '150,000.00',
  costo_total: '162,300.00',
  autor_nombre: 'Carlos Peña',
  tarea_titulo: 'Cotizar materiales',
  contenido: 'Ya hablé con el proveedor, esperando respuesta.',
  actividad_descripcion: 'Llamar para seguimiento de propuesta',
  comentario: 'Cambiale el color del banner a azul',
  tipo_ncf: 'B01',
  restantes: '25',
  umbral_alerta: '50',
};

/** Extrae `{{nombre}}` del texto — cubre variables que todavía no estén en CATALOGO_EVENTOS_NOTIFICACION. */
function extraerNombresDeVariables(texto: string): string[] {
  const nombres = new Set<string>();
  for (const [, nombre] of texto.matchAll(/{{\s*(\w+)\s*}}/g)) nombres.add(nombre);
  return [...nombres];
}

export function generarValoresEjemplo(nombresVariables: string[]): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const nombre of nombresVariables) valores[nombre] = EJEMPLOS_POR_NOMBRE[nombre] ?? `[${nombre}]`;
  return valores;
}

export function generarValoresEjemploDesdeTexto(...textos: (string | undefined)[]): Record<string, string> {
  const nombres = extraerNombresDeVariables(textos.filter((t): t is string => !!t).join('\n'));
  return generarValoresEjemplo(nombres);
}
