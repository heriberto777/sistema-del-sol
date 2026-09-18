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

  // Nombres de variable exclusivos de este describe (nunca usados en los
  // tests de arriba) — la validación cruzada usa un registro interno que
  // vive todo el proceso a propósito (ver el comentario en el archivo
  // fuente), así que estos tests evitan cualquier variable ya tocada
  // antes para no depender del orden de ejecución.
  describe('validación cruzada entre dominios de auth (defensa en profundidad)', () => {
    it('lanza si dos variables DISTINTAS resuelven al mismo secreto', () => {
      const varA = 'JWT_SECRET_CRUZADO_A';
      const varB = 'JWT_SECRET_CRUZADO_B';
      process.env[varA] = 'un-secreto-compartido-por-error';
      process.env[varB] = 'un-secreto-compartido-por-error';

      obtenerSecretoJwt(varA);
      expect(() => obtenerSecretoJwt(varB)).toThrow(/mismo valor/);

      delete process.env[varA];
      delete process.env[varB];
    });

    it('no lanza si la MISMA variable se resuelve varias veces con el mismo valor (caso normal: varios módulos la leen)', () => {
      const varC = 'JWT_SECRET_REPETIDO_C';
      process.env[varC] = 'un-secreto-leido-dos-veces';

      expect(obtenerSecretoJwt(varC)).toBe('un-secreto-leido-dos-veces');
      expect(obtenerSecretoJwt(varC)).toBe('un-secreto-leido-dos-veces');

      delete process.env[varC];
    });
  });
});
