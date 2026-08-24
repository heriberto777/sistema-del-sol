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

  describe('personalización (plan de integración Cuadre, ítem H-3)', () => {
    // PNG 1x1 transparente — el logo real de un tenant no importa para esta prueba, solo que un data URI válido no rompa la generación.
    const LOGO_1PX =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    it('incluye el logo sin romper el documento', async () => {
      const buffer = await generarDocumentoPdf({
        tipoDocumento: 'Factura de venta',
        numero: 'B0200000001',
        fecha: new Date('2026-01-15'),
        cliente: 'Cliente Demo',
        lineas: [{ concepto: 'Producto A', cantidad: '2', precioUnitario: '100.00', total: '236.00' }],
        subtotal: 200,
        itbis: 36,
        total: 236,
        logo: LOGO_1PX,
      });

      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });

    it('un logo corrupto no bloquea la generación del documento', async () => {
      const buffer = await generarDocumentoPdf({
        tipoDocumento: 'Factura de venta',
        numero: 'B0200000001',
        fecha: new Date('2026-01-15'),
        cliente: 'Cliente Demo',
        lineas: [{ concepto: 'Producto A', cantidad: '2', precioUnitario: '100.00', total: '236.00' }],
        subtotal: 200,
        itbis: 36,
        total: 236,
        logo: 'data:image/png;base64,esto-no-es-una-imagen-valida',
      });

      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });

    it('incluye la nota de pie sin romper el documento', async () => {
      const buffer = await generarDocumentoPdf({
        tipoDocumento: 'Factura de venta',
        numero: 'B0200000001',
        fecha: new Date('2026-01-15'),
        cliente: 'Cliente Demo',
        lineas: [{ concepto: 'Producto A', cantidad: '2', precioUnitario: '100.00', total: '236.00' }],
        subtotal: 200,
        itbis: 36,
        total: 236,
        notaPie: 'Gracias por su compra',
      });

      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });
  });
});
