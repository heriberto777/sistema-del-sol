import { generarDocumentoTicketHtml } from './documento-ticket';

describe('generarDocumentoTicketHtml', () => {
  it('genera un documento HTML completo con precios (factura/cotización), 80mm', () => {
    const html = generarDocumentoTicketHtml(
      {
        tipoDocumento: 'Factura de venta',
        numero: 'B0200000001',
        fecha: new Date('2026-01-15'),
        cliente: 'Cliente Demo',
        lineas: [{ concepto: 'Producto A', cantidad: '2', precioUnitario: '100.00', total: '236.00' }],
        subtotal: 200,
        descuento: 0,
        itbis: 36,
        total: 236,
      },
      'TERMICA_80MM',
    );

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('80mm auto');
    expect(html).toContain('Producto A');
    expect(html).toContain('RD$ 236.00');
    expect(html).toContain('window.print()');
  });

  it('omite columnas de precio/total y el resumen cuando mostrarPrecios es false (remisión)', () => {
    const html = generarDocumentoTicketHtml(
      {
        tipoDocumento: 'Remisión',
        numero: 'REM-001',
        fecha: new Date('2026-01-15'),
        cliente: 'Cliente Demo',
        mostrarPrecios: false,
        lineas: [{ concepto: 'Producto A', cantidad: '2' }],
      },
      'TERMICA_58MM',
    );

    expect(html).toContain('58mm auto');
    expect(html).not.toContain('Subtotal');
    expect(html).not.toContain('Total');
  });

  it('escapa HTML de campos influenciados por el usuario final (previene XSS almacenado)', () => {
    const html = generarDocumentoTicketHtml(
      {
        tipoDocumento: 'Factura de venta',
        numero: 'B0200000001',
        fecha: new Date('2026-01-15'),
        cliente: '<script>alert(1)</script>',
        lineas: [{ concepto: '<img src=x onerror=alert(1)>', cantidad: '1', precioUnitario: '10.00', total: '10.00' }],
        subtotal: 10,
        total: 10,
      },
      'TERMICA_80MM',
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x');
  });
});
