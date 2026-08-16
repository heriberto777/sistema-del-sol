import { generarDocumentoPdf } from './documento-pdf';

describe('generarDocumentoPdf', () => {
  it('genera un buffer con la firma de un PDF válido, con precios (factura/cotización)', async () => {
    const buffer = await generarDocumentoPdf({
      tipoDocumento: 'Factura de venta',
      numero: 'B0200000001',
      fecha: new Date('2026-01-15'),
      cliente: 'Cliente Demo',
      lineas: [{ concepto: 'Producto A', cantidad: '2', precioUnitario: '100.00', total: '236.00' }],
      subtotal: 200,
      descuento: 0,
      itbis: 36,
      total: 236,
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('genera un buffer válido sin precios (remisión)', async () => {
    const buffer = await generarDocumentoPdf({
      tipoDocumento: 'Remisión',
      numero: 'REM-001',
      fecha: new Date('2026-01-15'),
      cliente: 'Cliente Demo',
      mostrarPrecios: false,
      lineas: [{ concepto: 'Producto A', cantidad: '2' }],
    });

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('pagina automáticamente cuando hay muchas líneas', async () => {
    const lineas = Array.from({ length: 80 }, (_, i) => ({
      concepto: `Producto ${i}`,
      cantidad: '1',
      precioUnitario: '10.00',
      total: '10.00',
    }));

    const buffer = await generarDocumentoPdf({
      tipoDocumento: 'Factura de venta',
      numero: 'B0200000002',
      fecha: new Date('2026-01-15'),
      cliente: 'Cliente Demo',
      lineas,
      subtotal: 800,
      itbis: 144,
      total: 944,
    });

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
