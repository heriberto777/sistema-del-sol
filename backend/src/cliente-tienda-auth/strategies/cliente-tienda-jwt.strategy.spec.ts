process.env.CLIENTE_TIENDA_JWT_SECRET ??= 'jest-test-jwt-secret-cliente-tienda';

import { UnauthorizedException } from '@nestjs/common';
import { ClienteTiendaJwtStrategy } from './cliente-tienda-jwt.strategy';
import { ClienteTiendaPayload } from '../cliente-tienda-authenticated-request';

describe('ClienteTiendaJwtStrategy', () => {
  const payload: ClienteTiendaPayload = { clienteId: 'c1', tenantId: 't1', email: 'ana@ejemplo.com' };

  function reqConToken(token: string) {
    return { headers: { authorization: `Bearer ${token}` } } as never;
  }

  it('deja pasar un token que no está en la blacklist', async () => {
    const redis = { client: { get: jest.fn().mockResolvedValue(null) } };
    const strategy = new ClienteTiendaJwtStrategy(redis as never);

    await expect(strategy.validate(reqConToken('token-valido'), payload)).resolves.toEqual(payload);
  });

  it('rechaza un token revocado (encontrado en la blacklist de Redis)', async () => {
    const redis = { client: { get: jest.fn().mockResolvedValue('1') } };
    const strategy = new ClienteTiendaJwtStrategy(redis as never);

    await expect(strategy.validate(reqConToken('token-cerrado'), payload)).rejects.toThrow(UnauthorizedException);
  });
});
