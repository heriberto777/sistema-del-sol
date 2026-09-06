import { construirCaptionProducto } from './construir-caption-producto.util';

describe('construirCaptionProducto', () => {
  it('solo nombre+precio cuando no hay categoría ni descripción', () => {
    expect(construirCaptionProducto({ nombre: 'Yogurt Fresa' }, '59.00')).toBe('Yogurt Fresa — RD$ 59.00');
  });

  it('sin precio: solo el nombre en la primera línea', () => {
    expect(construirCaptionProducto({ nombre: 'Yogurt Fresa' }, null)).toBe('Yogurt Fresa');
  });

  it('agrega la categoría cuando existe', () => {
    expect(construirCaptionProducto({ nombre: 'Yogurt Fresa', categoria: { nombre: 'Lácteos' } }, '59.00')).toBe(
      'Yogurt Fresa — RD$ 59.00\nCategoría: Lácteos',
    );
  });

  it('agrega la descripción de tienda cuando existe', () => {
    expect(
      construirCaptionProducto({ nombre: 'Yogurt Fresa', descripcionTienda: 'Yogurt natural sabor fresa.' }, '59.00'),
    ).toBe('Yogurt Fresa — RD$ 59.00\nYogurt natural sabor fresa.');
  });

  it('agrega categoría y descripción juntas, en ese orden', () => {
    expect(
      construirCaptionProducto(
        { nombre: 'Yogurt Fresa', categoria: { nombre: 'Lácteos' }, descripcionTienda: 'Yogurt natural sabor fresa.' },
        '59.00',
      ),
    ).toBe('Yogurt Fresa — RD$ 59.00\nCategoría: Lácteos\nYogurt natural sabor fresa.');
  });

  it('categoria null y descripcionTienda null no agregan líneas vacías', () => {
    expect(construirCaptionProducto({ nombre: 'Yogurt Fresa', categoria: null, descripcionTienda: null }, '59.00')).toBe(
      'Yogurt Fresa — RD$ 59.00',
    );
  });
});
