import { PrismaClient } from '@prisma/client';
import { cifrar } from '../src/common/utils/encriptado.util';

/**
 * Cifra los `Webhook.secret` en texto plano que quedaron de antes de la
 * auditoría de seguridad 2026-09-06 (`secretCifrado` es la única columna
 * que se escribe desde entonces — ver `WebhooksService.crear`).
 *
 * Idempotente: solo toca filas con `secret` no nulo y `secretCifrado` aún
 * nulo — se puede correr tantas veces como haga falta sin re-cifrar nada.
 * NO borra la columna `secret` vieja (eso es una migración aparte, una vez
 * confirmado que este backfill corrió en todos los entornos).
 *
 * Uso: pnpm --filter ./backend webhook-secrets:backfill
 */
async function main() {
  const prisma = new PrismaClient();

  const pendientes = await prisma.webhook.findMany({
    where: { secret: { not: null }, secretCifrado: null },
    select: { id: true, secret: true },
  });

  for (const webhook of pendientes) {
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: { secretCifrado: cifrar(webhook.secret as string), secret: null },
    });
  }

  console.log(
    pendientes.length > 0
      ? `Listo: ${pendientes.length} webhook(s) migrado(s) a secreto cifrado.`
      : 'Nada que migrar — todos los webhooks ya tienen secretCifrado (o no hay ninguno).',
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
