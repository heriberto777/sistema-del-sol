/**
 * Nombre de perfil de WhatsApp del contacto — `Username` (el que el
 * contacto eligió al configurar un username de WhatsApp, ver BSUID en
 * `schema.prisma`) gana sobre `ProfileName` (el nombre "clásico" que
 * Twilio manda para contactos con número real) si vinieran los dos.
 * `null` si no vino ninguno.
 */
export function resolverPerfilNombre(body: { Username?: string; ProfileName?: string }): string | null {
  return body.Username || body.ProfileName || null;
}
