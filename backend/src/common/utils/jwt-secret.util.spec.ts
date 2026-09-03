import { obtenerSecretoJwt } from './jwt-secret.util';

describe('jwt-secret.util', () => {
  const ENV_ORIGINAL = { ...process.env };
  const VAR = 'JWT_SECRET_DE_PRUEBA';

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  it('devuelve el valor si está seteado y no es un placeholder conocido', () => {
    process.env[VAR] = 'un-secreto-real-generado-random';
    expect(obtenerSecretoJwt(VAR)).toBe('un-secreto-real-generado-random');
  });

  it('lanza si la variable no está seteada', () => {
    delete process.env[VAR];
    expect(() => obtenerSecretoJwt(VAR)).toThrow(new RegExp(VAR));
  });

  it('lanza si la variable está vacía', () => {
    process.env[VAR] = '';
    expect(() => obtenerSecretoJwt(VAR)).toThrow(new RegExp(VAR));
  });

  it.each(['cambia-este-secreto-en-produccion', 'cambia-este-secreto-de-plataforma-en-produccion', 'cambia-este-secreto-de-cliente-tienda-en-produccion'])(
    'lanza si el valor sigue siendo el placeholder de .env.example (%s) — el bug real que motivó este util',
    (placeholder) => {
      process.env[VAR] = placeholder;
      expect(() => obtenerSecretoJwt(VAR)).toThrow(new RegExp(VAR));
    },
  );
});
