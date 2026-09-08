import { construirPromptFondoIa } from './construir-prompt-fondo-ia';

const BASE = {
  productoNombre: 'Yogurt Fresa',
  precioFormateado: 'RD$ 100.00',
  oferta: null,
  plantillaClave: 'minimalista',
  promptUsuario: '',
  tieneLogo: false,
};

describe('construirPromptFondoIa', () => {
  it('sin oferta: incluye el precio de lista exacto, nunca inventado', () => {
    const prompt = construirPromptFondoIa(BASE);

    expect(prompt).toContain('RD$ 100.00');
    expect(prompt).toContain('Yogurt Fresa');
    expect(prompt).not.toContain('undefined');
  });

  it('con oferta DESCUENTO: incluye precio anterior, precio nuevo y % OFF', () => {
    const prompt = construirPromptFondoIa({
      ...BASE,
      oferta: { tipo: 'DESCUENTO', precioConDescuento: 80, ahorro: 20, porcentaje: 20 },
    });

    expect(prompt).toContain('RD$ 100.00');
    expect(prompt).toContain('RD$ 80.00');
    expect(prompt).toContain('20% OFF');
  });

  it('con oferta BOGO: describe la promo con las cantidades reales', () => {
    const prompt = construirPromptFondoIa({
      ...BASE,
      oferta: { tipo: 'BOGO', comprarCantidad: 2, llevarCantidad: 3, porcentajeDescuentoLlevar: 50 },
    });

    expect(prompt).toContain('compra 2');
    expect(prompt).toContain('llevá 3');
    expect(prompt).toContain('50%');
  });

  it('con logo: pide incluirlo nítido, sin distorsionar', () => {
    const prompt = construirPromptFondoIa({ ...BASE, tieneLogo: true });

    expect(prompt.toLowerCase()).toContain('logo');
    expect(prompt.toLowerCase()).toContain('nítido');
  });

  it('sin logo: no menciona ningún logo', () => {
    const prompt = construirPromptFondoIa({ ...BASE, tieneLogo: false });

    expect(prompt.toLowerCase()).not.toContain('logo');
  });

  it('incluye el hint de estilo de la plantilla elegida', () => {
    const prompt = construirPromptFondoIa({ ...BASE, plantillaClave: 'oferta' });

    expect(prompt.toLowerCase()).toContain('cinta diagonal');
  });

  it('incluye la ambientación pedida por el usuario cuando viene', () => {
    const prompt = construirPromptFondoIa({ ...BASE, promptUsuario: 'fondo de cocina moderna' });

    expect(prompt).toContain('fondo de cocina moderna');
  });

  it('nunca deja que el usuario pida un precio propio — el prompt del usuario nunca reemplaza el precio real', () => {
    const prompt = construirPromptFondoIa({ ...BASE, promptUsuario: 'poné el precio en RD$ 1' });

    // El precio real sigue siendo el único "RD$" fuera de la ambientación del usuario.
    expect(prompt).toContain('RD$ 100.00');
  });
});
