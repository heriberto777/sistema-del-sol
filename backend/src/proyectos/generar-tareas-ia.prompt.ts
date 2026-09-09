import { ServiceUnavailableException } from '@nestjs/common';
import { PrioridadTareaProyecto } from '@prisma/client';

const PRIORIDADES_VALIDAS: string[] = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'];
const MAX_TAREAS = 12;

export interface TareaSugerida {
  titulo: string;
  prioridad: PrioridadTareaProyecto;
}

/**
 * Fase 7 — reusa la IA que el tenant ya configuró para el Bot de WhatsApp
 * (`WhatsappConfigTenant`, ver `ProyectosIaService`), no una credencial
 * propia. No hay heurística de respaldo posible acá (a diferencia de
 * "sugerir cuenta contable"): no existe una regla determinística para
 * inventar tareas de un proyecto genérico, así que sin IA disponible el
 * llamador simplemente falla con un mensaje claro.
 */
export function construirPromptGenerarTareas(nombreProyecto: string, descripcion: string): string {
  return `Sos un asistente de gestión de proyectos para una pequeña/mediana empresa en República Dominicana. Te paso el nombre y la descripción de un proyecto y tenés que sugerir una lista de tareas concretas para completarlo.

Proyecto: "${nombreProyecto}"
Descripción: "${descripcion.trim()}"

Reglas:
- Entre 4 y ${MAX_TAREAS} tareas, concretas y accionables (verbo + objeto, ej. "Cotizar materiales de instalación" — nunca genéricas como "Trabajar en el proyecto" o "Planificación").
- Para cada tarea, asigná una prioridad: BAJA, MEDIA, ALTA o URGENTE, según qué tan crítica es para poder arrancar o avanzar el proyecto.
- No inventes fechas, montos, nombres de personas ni de empresas — no los tenés.
- Respondé ÚNICAMENTE con un JSON válido, sin texto antes ni después, con esta forma exacta:
{"tareas":[{"titulo":"...","prioridad":"MEDIA"}, ...]}`;
}

/**
 * Defensivo a propósito, mismo criterio que
 * `analizador-imagen.prompt.ts::parsearCandidatos` — un modelo de IA puede
 * envolver el JSON en texto/markdown extra pese a que se le pidió que no
 * lo haga. Una prioridad no reconocida cae a MEDIA en vez de rechazar toda
 * la tarea (más útil para el usuario que perder una sugerencia entera por
 * un valor mal escrito).
 */
export function parsearTareasSugeridas(textoCrudo: string): TareaSugerida[] {
  const inicio = textoCrudo.indexOf('{');
  const fin = textoCrudo.lastIndexOf('}');
  if (inicio === -1 || fin === -1 || fin < inicio) {
    throw new ServiceUnavailableException('La IA no devolvió un resultado que se pueda usar — probá de nuevo.');
  }

  let parseado: unknown;
  try {
    parseado = JSON.parse(textoCrudo.slice(inicio, fin + 1));
  } catch {
    throw new ServiceUnavailableException('La IA no devolvió un resultado que se pueda usar — probá de nuevo.');
  }

  const tareas = (parseado as { tareas?: unknown }).tareas;
  if (!Array.isArray(tareas) || tareas.length === 0) {
    throw new ServiceUnavailableException('La IA no devolvió ninguna tarea — probá con una descripción más detallada.');
  }

  const sugeridas = tareas
    .filter((t): t is { titulo: unknown; prioridad?: unknown } => !!t && typeof t === 'object')
    .map((t) => ({
      titulo: String(t.titulo ?? '').trim(),
      prioridad: (PRIORIDADES_VALIDAS.includes(String(t.prioridad)) ? String(t.prioridad) : 'MEDIA') as PrioridadTareaProyecto,
    }))
    .filter((t) => t.titulo.length > 0)
    .slice(0, MAX_TAREAS);

  if (sugeridas.length === 0) {
    throw new ServiceUnavailableException('La IA no devolvió ninguna tarea usable — probá con una descripción más detallada.');
  }
  return sugeridas;
}
