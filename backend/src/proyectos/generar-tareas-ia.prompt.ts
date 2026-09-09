import { ServiceUnavailableException } from '@nestjs/common';
import { PrioridadTareaProyecto } from '@prisma/client';

const PRIORIDADES_VALIDAS: string[] = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'];
const MAX_HITOS = 6;
const MAX_TAREAS_POR_HITO = 8;
const MAX_TAREAS_SUELTAS = 8;

export interface TareaSugerida {
  titulo: string;
  prioridad: PrioridadTareaProyecto;
}

export interface HitoSugerido {
  nombre: string;
  tareas: TareaSugerida[];
}

export interface PlanSugerido {
  hitos: HitoSugerido[];
  tareasSinHito: TareaSugerida[];
}

/**
 * Fase 7 (extendida a pedido del usuario) — además de tareas sueltas, la
 * IA ahora agrupa en HITOS cuando tiene sentido. Un Hito real necesita
 * `fechaObjetivo`/`montoFijo` para servir de corte de facturación — datos
 * que la IA NO puede inventar (mismo criterio de "no inventes fechas ni
 * montos" del resto del prompt) — por eso solo sugiere el NOMBRE del
 * hito; fecha y monto los completa el usuario después, a mano, igual que
 * si lo hubiera creado desde "Nuevo hito".
 */
export function construirPromptGenerarTareas(nombreProyecto: string, descripcion: string): string {
  return `Sos un asistente de gestión de proyectos para una pequeña/mediana empresa en República Dominicana. Te paso el nombre y la descripción de un proyecto y tenés que armar un plan de trabajo: tareas concretas, agrupadas en HITOS cuando tenga sentido.

Proyecto: "${nombreProyecto}"
Descripción: "${descripcion.trim()}"

Reglas:
- Un HITO es una entrega o corte de trabajo real (ej. "Entrega de planos", "Instalación eléctrica") — agrupá ahí las tareas que le pertenecen. Si el proyecto es simple y no tiene entregas diferenciadas, no inventes hitos artificiales: dejá todas las tareas en "tareasSinHito".
- Entre 0 y ${MAX_HITOS} hitos. Cada hito: nombre corto y entre 1 y ${MAX_TAREAS_POR_HITO} tareas agrupadas debajo.
- No inventes fecha objetivo ni monto para ningún hito — esos los completa el usuario después a mano.
- Las tareas que no correspondan a ningún hito puntual (administrativas, transversales) van en "tareasSinHito" (hasta ${MAX_TAREAS_SUELTAS}).
- Cada tarea: título concreto y accionable (verbo + objeto, ej. "Cotizar materiales de instalación" — nunca genérico como "Trabajar en el proyecto"), y una prioridad: BAJA, MEDIA, ALTA o URGENTE.
- No inventes fechas, montos, nombres de personas ni de empresas — no los tenés.
- Respondé ÚNICAMENTE con un JSON válido, sin texto antes ni después, con esta forma exacta:
{"hitos":[{"nombre":"...","tareas":[{"titulo":"...","prioridad":"MEDIA"}]}],"tareasSinHito":[{"titulo":"...","prioridad":"MEDIA"}]}`;
}

function limpiarTareas(valor: unknown, tope: number): TareaSugerida[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((t): t is { titulo: unknown; prioridad?: unknown } => !!t && typeof t === 'object')
    .map((t) => ({
      titulo: String(t.titulo ?? '').trim(),
      prioridad: (PRIORIDADES_VALIDAS.includes(String(t.prioridad)) ? String(t.prioridad) : 'MEDIA') as PrioridadTareaProyecto,
    }))
    .filter((t) => t.titulo.length > 0)
    .slice(0, tope);
}

/**
 * Defensivo a propósito, mismo criterio que
 * `analizador-imagen.prompt.ts::parsearCandidatos` — un modelo de IA puede
 * envolver el JSON en texto/markdown extra pese a que se le pidió que no
 * lo haga. Un hito sin nombre se descarta entero (aunque tenga tareas
 * válidas — sin nombre no hay nada que crear); esas tareas se pierden, no
 * se reasignan solas a "sueltas" para no adivinar la intención.
 */
export function parsearPlanSugerido(textoCrudo: string): PlanSugerido {
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

  const bruto = parseado as { hitos?: unknown; tareasSinHito?: unknown };

  const hitos: HitoSugerido[] = Array.isArray(bruto.hitos)
    ? bruto.hitos
        .filter((h): h is { nombre: unknown; tareas?: unknown } => !!h && typeof h === 'object')
        .map((h) => ({ nombre: String(h.nombre ?? '').trim(), tareas: limpiarTareas(h.tareas, MAX_TAREAS_POR_HITO) }))
        .filter((h) => h.nombre.length > 0)
        .slice(0, MAX_HITOS)
    : [];

  const tareasSinHito = limpiarTareas(bruto.tareasSinHito, MAX_TAREAS_SUELTAS);

  const totalTareas = hitos.reduce((acc, h) => acc + h.tareas.length, 0) + tareasSinHito.length;
  if (hitos.length === 0 && totalTareas === 0) {
    throw new ServiceUnavailableException('La IA no devolvió ningún hito ni tarea usable — probá con una descripción más detallada.');
  }

  return { hitos, tareasSinHito };
}
