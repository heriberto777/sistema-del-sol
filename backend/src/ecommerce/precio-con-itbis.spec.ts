import { factorItbis, ofertaConItbis, precioConItbis } from './precio-con-itbis';

describe('precioConItbis', () => {
  it('suma el ITBIS del producto al precio de lista', () => {
    expect(precioConItbis(100, 18)).toBe('118.0000');
  });

  it('porcentajeItbis 0 (producto exento) deja el precio igual', () => {
    expect(precioConItbis(100, 0)).toBe('100.0000');
  });

  it('null/undefined pasan tal cual — no inventa un precio', () => {
    expect(precioConItbis(null, 18)).toBeNull();
    expect(precioConItbis(undefined, 18)).toBeNull();
  });

  it('acepta precio y porcentajeItbis como string (formato Prisma Decimal serializado)', () => {
    expect(precioConItbis('299.70', '18')).toBe('353.6460');
  });

  it('4 decimales (no 2) para que cantidad × precio en el carrito no se desvíe del total real por redondeo acumulado', () => {
    // Con 2 decimales: 353.65 × 2 = 707.30, pero el total real (cotizar()) da 707.29 — 1 centavo de diferencia real, verificado en vivo.
    const precioUnitario = Number(precioConItbis('299.70', '18'));
    expect((precioUnitario * 2).toFixed(2)).toBe('707.29');
  });
});

describe('ofertaConItbis', () => {
  it('DESCUENTO: escala precioConDescuento y ahorro por el mismo factor, sin tocar el porcentaje', () => {
    const oferta = ofertaConItbis({ tipo: 'DESCUENTO', precioConDescuento: 90, ahorro: 10, porcentaje: 10 }, 18);
    expect(oferta).toEqual({ tipo: 'DESCUENTO', precioConDescuento: 106.2, ahorro: 11.8, porcentaje: 10 });
  });

  it('BOGO: no tiene montos propios — pasa sin cambios', () => {
    const oferta = ofertaConItbis({ tipo: 'BOGO', comprarCantidad: 1, llevarCantidad: 1, porcentajeDescuentoLlevar: 100 }, 18);
    expect(oferta).toEqual({ tipo: 'BOGO', comprarCantidad: 1, llevarCantidad: 1, porcentajeDescuentoLlevar: 100 });
  });

  it('null pasa tal cual', () => {
    expect(ofertaConItbis(null, 18)).toBeNull();
  });

  it('MONTO_FIJO (ahorro no proporcional al precio) también escala correctamente — es lineal, no depende del tipo de descuento original', () => {
    // RD$100 OFF sobre un precio de RD$500 (20%) — el motor de ofertas ya resolvió esto como DESCUENTO/ahorro fijo antes de llegar acá.
    const oferta = ofertaConItbis({ tipo: 'DESCUENTO', precioConDescuento: 400, ahorro: 100, porcentaje: 20 }, 18);
    expect(oferta).toEqual({ tipo: 'DESCUENTO', precioConDescuento: 472, ahorro: 118, porcentaje: 20 });
  });
});

describe('factorItbis', () => {
  it('18% → 1.18', () => {
    expect(factorItbis(18)).toBe(1.18);
  });
  it('sin valor → 1 (sin impuesto)', () => {
    expect(factorItbis(undefined)).toBe(1);
  });
});
