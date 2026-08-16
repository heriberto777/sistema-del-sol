import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

/**
 * Crea (o actualiza la contraseña de) el rol de Postgres restringido que usa
 * TenantPrismaService — ver docs/ARCHITECTURE.md, sección "Multi-tenancy".
 * Correr UNA vez (y de nuevo si cambia APP_DB_PASSWORD), antes de `db:rls`:
 *   pnpm --filter ./backend db:app-role
 */

// Escapa un valor para insertarlo dentro de un literal '...' o un
// identificador "..." de Postgres, doblando la comilla correspondiente.
function escaparLiteral(valor: string): string {
  return valor.replace(/'/g, "''");
}
function escaparIdentificador(valor: string): string {
  return valor.replace(/"/g, '""');
}

/**
 * `$executeRawUnsafe` manda el SQL como una sola sentencia preparada —
 * Postgres rechaza varias sentencias separadas por `;` en una sola
 * preparación ("cannot insert multiple commands into a prepared statement").
 * Este split es deliberadamente simple (no un parser SQL completo): separa
 * por `;` salvo dentro de un bloque `$$...$$` (el `DO $$ ... END $$;` del
 * archivo, que tiene sus propios `;` internos que NO son fin de sentencia).
 * Suficiente para el SQL controlado de create-app-role.sql — no pensado
 * para SQL arbitrario.
 */
function dividirEnSentencias(sql: string): string[] {
  // Sacar los comentarios de línea completa ANTES de partir en sentencias —
  // si no, una sentencia real precedida por comentarios queda con un '--' al
  // principio del string acumulado y es indistinguible de un bloque que es
  // puro comentario.
  const sinComentarios = sql
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('--'))
    .join('\n');

  const sentencias: string[] = [];
  let actual = '';
  let dentroDeBloque = false;

  for (const linea of sinComentarios.split('\n')) {
    actual += (actual ? '\n' : '') + linea;
    if (linea.includes('$$')) {
      dentroDeBloque = !dentroDeBloque;
    }
    if (!dentroDeBloque && actual.trim().endsWith(';')) {
      sentencias.push(actual.trim());
      actual = '';
    }
  }
  if (actual.trim()) {
    sentencias.push(actual.trim());
  }
  return sentencias.filter((s) => s.length > 0);
}

async function main() {
  const appDbUser = process.env.APP_DB_USER;
  const appDbPassword = process.env.APP_DB_PASSWORD;
  const dbName = process.env.POSTGRES_DB;

  if (!appDbUser || !appDbPassword || !dbName) {
    console.error(
      'Faltan APP_DB_USER/APP_DB_PASSWORD/POSTGRES_DB en el .env. Agregalas antes de correr este script.',
    );
    process.exit(1);
  }

  const plantilla = readFileSync(join(__dirname, '..', 'prisma', 'sql', 'create-app-role.sql'), 'utf-8');
  const sql = plantilla
    .replaceAll('__APP_DB_USER_IDENT__', escaparIdentificador(appDbUser))
    .replaceAll('__APP_DB_USER_LITERAL__', escaparLiteral(appDbUser))
    .replaceAll('__APP_DB_PASSWORD_LITERAL__', escaparLiteral(appDbPassword))
    .replaceAll('__DB_NAME_IDENT__', escaparIdentificador(dbName));

  const prisma = new PrismaClient();
  for (const sentencia of dividirEnSentencias(sql)) {
    await prisma.$executeRawUnsafe(sentencia);
  }
  await prisma.$disconnect();

  console.log(`Rol "${appDbUser}" listo (creado o actualizado) con acceso a la base "${dbName}".`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
