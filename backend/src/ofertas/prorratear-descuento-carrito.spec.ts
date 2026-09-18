import { prorratearDescuentoCarrito } from './prorratear-descuento-carrito';

describe('prorratearDescuentoCarrito', () => {
  it('reparte el descuento proporcionalmente al monto de cada línea', () => {
    const resultado = prorratearDescuentoCarrito(1000, [750, 250], 100);

    expect(resultado[0]).toBeCloseTo(75);
    expect(resultado[1]).toBeCloseTo(25);
  });

  it('la suma de lo repartido es exactamente el descuento total', () => {
    const resultado = prorratearDescuentoCarrito(300, [100, 100, 100], 30);

    expect(resultado.reduce((acc, x) => acc + x, 0)).toBe(30);
  });

  it('cuando el descuento no divide exacto entre las líneas, la última absorbe el residuo (hallazgo de auditoría)', () => {
    // RD$10 entre 3 líneas iguales = RD$3.33... por línea — sin reconciliar,
    // 3.33+3.33+3.33 = 9.99, no 10. La última línea se lleva el centavo extra.
    const resultado = prorratearDescuentoCarrito(300, [100, 100, 100], 10);

    expect(resultado).toEqual([3.33, 3.33, 3.34]);
    expect(resultado.reduce((acc, x) => acc + x, 0)).toBe(10);
  });

  it('sin descuento de carrito, devuelve ceros para todas las líneas', () => {
    const resultado = prorratearDescuentoCarrito(1000, [750, 250], 0);

    expect(resultado).toEqual([0, 0]);
  });

  it('con subtotal 0 (no debería pasar en la práctica), devuelve ceros en vez de dividir por 0', () => {
    const resultado = prorratearDescuentoCarrito(0, [0, 0], 50);

    expect(resultado).toEqual([0, 0]);
  });
});
