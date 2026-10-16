/** Iniciales de un nombre completo, para avatares — antes vivía enterrada dentro de KanbanTareas.tsx (auditoría de estructura del frontend). */
export function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Iniciales para un contacto de WhatsApp — puede no tener nombre real
 * (Twilio no siempre manda `ProfileName`). Sin esto, `inicialesDe` sobre
 * un teléfono tipo "+18095551234" devolvía "+1" (el primer carácter de
 * cada "palabra" separada por espacios, que acá no existen) — se cae a
 * los últimos 2 dígitos del teléfono en ese caso.
 */
export function inicialesContacto(nombre: string | null | undefined, telefono: string): string {
  if (nombre?.trim()) {
    const iniciales = inicialesDe(nombre);
    if (/^[A-ZÁÉÍÓÚÑ]+$/.test(iniciales)) return iniciales;
  }
  const digitos = telefono.replace(/\D/g, '');
  return digitos.slice(-2) || '?';
}
