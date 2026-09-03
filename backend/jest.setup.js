// Jest no carga `.env` (a diferencia de `dotenv -e ../.env -- ...` que sí
// usan los scripts de `pnpm`) — sin esto, cualquier módulo que lea
// JWT_SECRET/PLATFORM_JWT_SECRET/CLIENTE_TIENDA_JWT_SECRET al importarse
// (JwtModule.register, constructores de estrategia Passport, la
// constante de cliente-tienda) revienta el arranque del test con "Falta
// configurar ..." — ver jwt-secret.util.ts. Valores obviamente falsos,
// nunca los mismos que .env.example, solo para que los tests no exploten.
process.env.JWT_SECRET ??= 'jest-test-jwt-secret-tenant';
process.env.PLATFORM_JWT_SECRET ??= 'jest-test-jwt-secret-plataforma';
process.env.CLIENTE_TIENDA_JWT_SECRET ??= 'jest-test-jwt-secret-cliente-tienda';
