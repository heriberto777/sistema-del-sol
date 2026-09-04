import { resolverBannerAnuncio, resolverTemaTienda } from './resolver-config-tienda';

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
      estiloInsigniaOferta: 'CLASICO',
      mostrarSeccionOfertas: true,
      estiloInsigniaSinStock: 'ETIQUETA',
    });
  });

  it('con estiloInsigniaSinStock fuera de las opciones válidas, cae a ETIQUETA', () => {
    const tema = resolverTemaTienda(JSON.stringify({ estiloInsigniaSinStock: 'BRILLANTE' }), undefined);
    expect(tema.estiloInsigniaSinStock).toBe('ETIQUETA');
  });

  it('con estiloInsigniaSinStock válido, lo refleja', () => {
    const tema = resolverTemaTienda(JSON.stringify({ estiloInsigniaSinStock: 'CINTA' }), undefined);
    expect(tema.estiloInsigniaSinStock).toBe('CINTA');
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
      estiloInsigniaOferta: 'CINTA',
      mostrarSeccionOfertas: false,
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
    expect(tema.estiloInsigniaOferta).toBe('CINTA');
    expect(tema.mostrarSeccionOfertas).toBe(false);
  });

  it('con estiloInsigniaOferta fuera de las opciones válidas, cae a CLASICO', () => {
    const tema = resolverTemaTienda(JSON.stringify({ estiloInsigniaOferta: 'DORADA' }), undefined);
    expect(tema.estiloInsigniaOferta).toBe('CLASICO');
  });

  it('sin mostrarSeccionOfertas guardado, el default es true', () => {
    expect(resolverTemaTienda(undefined, undefined).mostrarSeccionOfertas).toBe(true);
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

describe('resolverBannerAnuncio', () => {
  it('sin valor guardado, no hay mensajes', () => {
    expect(resolverBannerAnuncio(undefined)).toEqual({ mensajes: [], intervaloSegundos: 5 });
  });

  it('con un string plano (formato legado, antes del slide), lo trata como un único mensaje sin color propio', () => {
    const banner = resolverBannerAnuncio('Envío gratis desde RD$ 3,000');
    expect(banner).toEqual({
      mensajes: [{ texto: 'Envío gratis desde RD$ 3,000', colorFondo: null, colorTexto: '#ffffff', tamanoFuente: 'NORMAL' }],
      intervaloSegundos: 5,
    });
  });

  it('con JSON válido de varios mensajes, refleja cada uno con su propio estilo', () => {
    const valorJson = JSON.stringify({
      mensajes: [
        { texto: 'Envío gratis', colorFondo: '#111827', colorTexto: '#ffffff', tamanoFuente: 'NORMAL' },
        { texto: '2x1 en camisas', colorFondo: '#c66b78', colorTexto: '#000000', tamanoFuente: 'GRANDE' },
      ],
      intervaloSegundos: 8,
    });
    const banner = resolverBannerAnuncio(valorJson);
    expect(banner.mensajes).toHaveLength(2);
    expect(banner.mensajes[1]).toEqual({ texto: '2x1 en camisas', colorFondo: '#c66b78', colorTexto: '#000000', tamanoFuente: 'GRANDE' });
    expect(banner.intervaloSegundos).toBe(8);
  });

  it('con JSON corrupto (no parseable), cae al string completo como mensaje legado sin lanzar', () => {
    expect(() => resolverBannerAnuncio('{esto no es json')).not.toThrow();
    expect(resolverBannerAnuncio('{esto no es json').mensajes[0].texto).toBe('{esto no es json');
  });

  it('descarta mensajes sin texto o con texto vacío/solo espacios', () => {
    const valorJson = JSON.stringify({ mensajes: [{ texto: '  ' }, { texto: 'Válido' }, {}] });
    expect(resolverBannerAnuncio(valorJson).mensajes).toEqual([
      { texto: 'Válido', colorFondo: null, colorTexto: '#ffffff', tamanoFuente: 'NORMAL' },
    ]);
  });

  it('con colorFondo/colorTexto con formato inválido, cae a null/blanco sin afectar el texto', () => {
    const valorJson = JSON.stringify({ mensajes: [{ texto: 'Hola', colorFondo: 'rojo', colorTexto: 'no-es-color' }] });
    const mensaje = resolverBannerAnuncio(valorJson).mensajes[0];
    expect(mensaje.colorFondo).toBeNull();
    expect(mensaje.colorTexto).toBe('#ffffff');
  });

  it('con tamanoFuente fuera de las opciones válidas, cae a NORMAL', () => {
    const valorJson = JSON.stringify({ mensajes: [{ texto: 'Hola', tamanoFuente: 'ENORME' }] });
    expect(resolverBannerAnuncio(valorJson).mensajes[0].tamanoFuente).toBe('NORMAL');
  });

  it('con intervaloSegundos fuera de rango, lo acota entre 2 y 30', () => {
    const bajo = JSON.stringify({ mensajes: [{ texto: 'Hola' }], intervaloSegundos: 0 });
    const alto = JSON.stringify({ mensajes: [{ texto: 'Hola' }], intervaloSegundos: 999 });
    expect(resolverBannerAnuncio(bajo).intervaloSegundos).toBe(2);
    expect(resolverBannerAnuncio(alto).intervaloSegundos).toBe(30);
  });

  it('con intervaloSegundos inválido (no numérico), usa el default de 5', () => {
    const valorJson = JSON.stringify({ mensajes: [{ texto: 'Hola' }], intervaloSegundos: 'rápido' });
    expect(resolverBannerAnuncio(valorJson).intervaloSegundos).toBe(5);
  });
});
