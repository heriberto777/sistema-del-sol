import { resolverTemaTienda } from './resolver-config-tienda';

describe('resolverTemaTienda', () => {
  it('sin TIENDA_TEMA, siembra colorAcento desde el valor legacy y usa defaults en el resto', () => {
    const tema = resolverTemaTienda(undefined, '#ff0000');
    expect(tema).toEqual({
      colorAcento: '#ff0000',
      colorFondo: null,
      colorSuperficie: null,
      colorTexto: null,
      fuenteDisplay: null,
      fuenteBody: null,
      tamanoFuente: 'MEDIANO',
      radioTarjeta: 'SUAVE',
      sombraTarjeta: true,
      proporcionImagen: 'CUADRADA',
      menu: [
        { clave: 'inicio', visible: true },
        { clave: 'categorias', visible: true },
        { clave: 'carrito', visible: true },
        { clave: 'cuenta', visible: true },
      ],
    });
  });

  it('sin TIENDA_TEMA ni color legacy, colorAcento queda null (cada plantilla nueva usa su propio default)', () => {
    expect(resolverTemaTienda(undefined, undefined).colorAcento).toBeNull();
  });

  it('con JSON válido, refleja todos los campos', () => {
    const valorJson = JSON.stringify({
      colorAcento: '#c66b78',
      colorFondo: '#faf3f0',
      colorSuperficie: '#ffffff',
      colorTexto: '#3a2c2f',
      fuenteDisplay: 'Bodoni Moda',
      fuenteBody: 'Nunito Sans',
      tamanoFuente: 'GRANDE',
      radioTarjeta: 'REDONDEADA',
      sombraTarjeta: false,
      proporcionImagen: 'VERTICAL',
      menu: [
        { clave: 'categorias', visible: true },
        { clave: 'inicio', visible: false },
        { clave: 'carrito', visible: true },
        { clave: 'cuenta', visible: true },
      ],
    });
    const tema = resolverTemaTienda(valorJson, '#000000');
    expect(tema.colorAcento).toBe('#c66b78');
    expect(tema.colorFondo).toBe('#faf3f0');
    expect(tema.fuenteDisplay).toBe('Bodoni Moda');
    expect(tema.tamanoFuente).toBe('GRANDE');
    expect(tema.radioTarjeta).toBe('REDONDEADA');
    expect(tema.sombraTarjeta).toBe(false);
    expect(tema.proporcionImagen).toBe('VERTICAL');
    expect(tema.menu[0]).toEqual({ clave: 'categorias', visible: true });
  });

  it('con JSON corrupto (no parseable), cae a los defaults sin lanzar', () => {
    expect(() => resolverTemaTienda('{esto no es json', '#111111')).not.toThrow();
    const tema = resolverTemaTienda('{esto no es json', '#111111');
    expect(tema.colorAcento).toBe('#111111');
    expect(tema.tamanoFuente).toBe('MEDIANO');
  });

  it('con un campo fuera de las opciones válidas, cae al default de ESE campo sin afectar los demás', () => {
    const valorJson = JSON.stringify({
      colorAcento: '#c66b78',
      fuenteDisplay: 'Comic Sans MS',
      tamanoFuente: 'ENORME',
      radioTarjeta: 'PUNTIAGUDA',
    });
    const tema = resolverTemaTienda(valorJson, undefined);
    expect(tema.colorAcento).toBe('#c66b78');
    expect(tema.fuenteDisplay).toBeNull();
    expect(tema.tamanoFuente).toBe('MEDIANO');
    expect(tema.radioTarjeta).toBe('SUAVE');
  });

  it('con un menú incompleto o con claves inválidas, cae al menú default completo', () => {
    const valorJson = JSON.stringify({ menu: [{ clave: 'inicio', visible: false }] });
    const tema = resolverTemaTienda(valorJson, undefined);
    expect(tema.menu).toHaveLength(4);
    expect(tema.menu.every((it) => it.visible)).toBe(true);
  });

  it('con colorAcento con formato inválido, ignora el valor y usa el legacy o null', () => {
    const valorJson = JSON.stringify({ colorAcento: 'rojo' });
    expect(resolverTemaTienda(valorJson, '#222222').colorAcento).toBe('#222222');
    expect(resolverTemaTienda(valorJson, undefined).colorAcento).toBeNull();
  });
});
