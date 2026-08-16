import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const sql = readFileSync(join(__dirname, '..', 'prisma', 'sql', 'enable-rls.sql'), 'utf-8');
  await prisma.$executeRawUnsafe(sql);
  await prisma.$disconnect();
  console.log('Row-Level Security aplicado.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
