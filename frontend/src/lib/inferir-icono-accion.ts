import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Ban,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileText,
  Filter,
  type LucideIcon,
  PackageCheck,
  Pencil,
  Plus,
  Printer,
  Save,
  Search,
  Send,
  Tag,
  Trash2,
  Undo2,
  Unlock,
  Upload,
  X,
} from 'lucide-react';

/**
 * Ícono inferido a partir de la ETIQUETA de un botón/acción — así un botón
 * nuevo se ve consistente con el resto del proyecto sin tener que pasarle
 * un `icon`/`icono` a mano en cada lugar. Mismo criterio ya validado en
 * `RowActionsMenu` (menú de "más acciones" por fila), generalizado acá
 * para reusarlo también en botones de `<Button>` sueltos.
 *
 * El orden de evaluación importa: la primera coincidencia gana (ej.
 * "Ver detalle" no debe caer en una regla más genérica si hubiera
 * ambigüedad). Patrones ANCLADOS al inicio (`^`) donde la palabra podría
 * aparecer también como sustantivo en medio de una frase no-accionable
 * (ej. "abrir" evitando falsos positivos en textos descriptivos).
 */
export const INFERENCIA_ICONO_ACCION: [RegExp, LucideIcon][] = [
  [/^anterior$/i, ChevronLeft],
  [/^siguiente$/i, ChevronRight],
  [/imprimir|imprimiendo/i, Printer],
  [/^ver\b|ver detalle|ver entregas/i, Eye],
  [/buscar/i, Search],
  [/eliminar|eliminando|borrar|borrando/i, Trash2],
  [/anular|anulando|rechazar|rechazando|desactivar|desactivando/i, Ban],
  [/^(nuevo|nueva|crear|creando|agregar|agregando|añadir|añadiendo)\b/i, Plus],
  [/^(guardar|guardando|registrar|registrando)\b/i, Save],
  [/^editar|editando/i, Pencil],
  [/duplicar|duplicando/i, Copy],
  [/exportar|exportando|descargar|descargando/i, Download],
  [/importar|importando/i, Upload],
  [/^abrir\b/i, Unlock],
  [/^(aceptar|marcar|activar|activando|confirmar|confirmando)\b/i, CheckCircle2],
  [/^enviar|enviando|publicar|publicando/i, Send],
  [/cobro|pago/i, Banknote],
  [/recibir|recibiendo/i, PackageCheck],
  [/devolver|devolviendo/i, Undo2],
  [/convertir|convirtiendo|^emitir|emitiendo/i, FileText],
  [/precio/i, Tag],
  [/^transferir|transfiriendo/i, ArrowLeftRight],
  [/^filtrar/i, Filter],
  [/^volver$/i, ArrowLeft],
  [/^continuar$/i, ArrowRight],
  [/^cancelar|^cerrar/i, X],
];

export function inferirIconoAccion(etiqueta: string): LucideIcon | undefined {
  return INFERENCIA_ICONO_ACCION.find(([patron]) => patron.test(etiqueta))?.[1];
}
