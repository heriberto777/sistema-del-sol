import { resolverPerfilNombre } from './resolver-perfil-nombre.util';

describe('resolverPerfilNombre', () => {
  it('prioriza Username sobre ProfileName si vienen los dos', () => {
    expect(resolverPerfilNombre({ Username: 'rosa.m', ProfileName: 'Rosa Martínez' })).toBe('rosa.m');
  });

  it('usa ProfileName si no vino Username', () => {
    expect(resolverPerfilNombre({ ProfileName: 'Rosa Martínez' })).toBe('Rosa Martínez');
  });

  it('usa Username si no vino ProfileName', () => {
    expect(resolverPerfilNombre({ Username: 'rosa.m' })).toBe('rosa.m');
  });

  it('null si no vino ninguno', () => {
    expect(resolverPerfilNombre({})).toBeNull();
  });
});
