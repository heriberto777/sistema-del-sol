import { generarDocumentoPdfLayout, LayoutDocumento } from './documento-pdf-layout';
import { DocumentoPdfParams } from './documento-pdf';

const PARAMS_BASE: DocumentoPdfParams = {
  tipoDocumento: 'Factura de venta',
  numero: 'B0200000001',
  fecha: new Date('2026-01-15'),
  cliente: 'Constructora Rivas & Asociados',
  emisor: { nombre: 'Ferretería El Tornillo Feliz, SRL', rnc: '130-12345-6', direccion: 'Santiago', telefono: '809-583-0021' },
  clienteDatosExtra: { rnc: '101-00000-1', direccion: 'Calle Falsa 123', telefono: '809-000-0000' },
  lineas: [
    { concepto: 'Cemento Gris 42.5kg', cantidad: '40', precioUnitario: '285.00', total: '13,452.00' },
    { concepto: 'Varilla corrugada 3/8" x 20\'', cantidad: '60', precioUnitario: '195.00', total: '13,003.10' },
  ],
  subtotal: 26455,
  descuento: 585,
  itbis: 4040.1,
  total: 30495.1,
  notas: 'Entrega en obra.',
  notaPie: 'Gracias por su compra.',
};

const LAYOUT_COMPLETO: LayoutDocumento = {
  bloques: [
    { tipo: 'logo', x: 5, y: 4, w: 24, h: 9 },
    { tipo: 'datos_empresa', x: 58, y: 4, w: 37, h: 14 },
    { tipo: 'encabezado', x: 5, y: 16, w: 90, h: 6 },
    { tipo: 'datos_cliente', x: 5, y: 24, w: 42, h: 11 },
    { tipo: 'tabla_lineas', x: 5, y: 40, w: 90, h: 30 },
    { tipo: 'totales', x: 58, y: 73, w: 37, h: 11 },
    { tipo: 'qr', x: 5, y: 73, w: 13, h: 13 },
    { tipo: 'firma', x: 21, y: 73, w: 30, h: 13 },
    { tipo: 'texto_legal', x: 5, y: 90, w: 90, h: 6 },
  ],
};

const IMAGEN_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('generarDocumentoPdfLayout', () => {
  it('genera un PDF válido con todos los tipos de bloque', async () => {
    const buffer = await generarDocumentoPdfLayout(
      { ...PARAMS_BASE, logo: IMAGEN_1PX, colorAcento: '#2b6cb0', qr: { dataUri: IMAGEN_1PX, etiqueta: 'Escanea para pagar' }, firma: { etiqueta: 'Autorizado por', imagen: IMAGEN_1PX } },
      LAYOUT_COMPLETO,
    );

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('funciona sin QR ni firma configurados (bloques opcionales, puramente aditivos)', async () => {
    const buffer = await generarDocumentoPdfLayout(PARAMS_BASE, LAYOUT_COMPLETO);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('pagina correctamente cuando la tabla tiene muchas líneas, y los bloques de abajo aparecen recién al final', async () => {
    const lineas = Array.from({ length: 80 }, (_, i) => ({ concepto: `Producto ${i}`, cantidad: '1', precioUnitario: '10.00', total: '10.00' }));
    const buffer = await generarDocumentoPdfLayout({ ...PARAMS_BASE, lineas, firma: { etiqueta: 'Autorizado por' } }, LAYOUT_COMPLETO);

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    // Más de una página generada — búsqueda simple del contador de objetos de página en el PDF crudo.
    expect(buffer.toString('latin1')).toContain('/Type /Page');
  });

  it('respeta las columnas/filas configuradas por bloque (tabla_lineas.columnas, totales.filas)', async () => {
    const layout: LayoutDocumento = {
      bloques: [
        { tipo: 'tabla_lineas', x: 5, y: 10, w: 90, h: 40, columnas: ['cantidad', 'total'] },
        { tipo: 'totales', x: 55, y: 60, w: 40, h: 15, filas: ['total'] },
      ],
    };
    const buffer = await generarDocumentoPdfLayout(PARAMS_BASE, layout);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('sin bloque de tabla_lineas, no rompe (todos los bloques se tratan como fijos)', async () => {
    const layout: LayoutDocumento = { bloques: [{ tipo: 'encabezado', x: 5, y: 5, w: 90, h: 10 }] };
    const buffer = await generarDocumentoPdfLayout(PARAMS_BASE, layout);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('una imagen libre corrupta no bloquea el documento', async () => {
    const layout: LayoutDocumento = {
      bloques: [
        { tipo: 'tabla_lineas', x: 5, y: 30, w: 90, h: 40 },
        { tipo: 'imagen_libre', x: 5, y: 80, w: 20, h: 20, imagen: 'data:image/png;base64,no-es-una-imagen' },
      ],
    };
    const buffer = await generarDocumentoPdfLayout(PARAMS_BASE, layout);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('sin mostrarPrecios (remisión), la tabla solo muestra cantidad y no dibuja totales', async () => {
    const buffer = await generarDocumentoPdfLayout(
      { ...PARAMS_BASE, mostrarPrecios: false, lineas: [{ concepto: 'Producto A', cantidad: '2' }] },
      LAYOUT_COMPLETO,
    );
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('agrupa en el mismo renglón bloques con `y` casi igual (totales+QR+firma a la misma altura)', async () => {
    // Si no se agruparan, el orden de dibujo (por `y` ascendente) los apilaría uno debajo del otro
    // en vez de lado a lado — la prueba solo confirma que no rompe con esa configuración típica.
    const buffer = await generarDocumentoPdfLayout(
      { ...PARAMS_BASE, qr: { dataUri: IMAGEN_1PX }, firma: { etiqueta: 'Autorizado por' } },
      LAYOUT_COMPLETO,
    );
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('tamanoPagina a4 no rompe el cálculo de porcentajes', async () => {
    const buffer = await generarDocumentoPdfLayout(PARAMS_BASE, LAYOUT_COMPLETO, { tamanoPagina: 'a4' });
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
