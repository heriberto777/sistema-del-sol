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

  describe('plantillas visuales (ítem "facturación — múltiples formatos")', () => {
    const PARAMS_BASE = {
      tipoDocumento: 'Factura de venta',
      numero: 'E310000000482',
      fecha: new Date('2026-09-17'),
      cliente: 'Constructora Rivas & Asociados',
      emisor: { nombre: 'Ferretería El Tornillo Feliz, SRL', rnc: '130-12345-6', direccion: 'Santiago de los Caballeros', telefono: '809-583-0021' },
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

    it.each(['ECF_OFICIAL', 'MINIMALISTA', 'COMPACTO', 'EDITORIAL'] as const)('%s: genera un PDF válido con emisor, notas y totales', async (plantilla) => {
      const buffer = await generarDocumentoPdf(PARAMS_BASE, { plantilla });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });

    it.each(['ECF_OFICIAL', 'MINIMALISTA', 'COMPACTO', 'EDITORIAL'] as const)('%s: sin emisor ni logo no rompe el documento', async (plantilla) => {
      const sinEmisor = { ...PARAMS_BASE, emisor: undefined };
      const buffer = await generarDocumentoPdf(sinEmisor, { plantilla });

      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });

    it.each(['ECF_OFICIAL', 'MINIMALISTA', 'COMPACTO', 'EDITORIAL'] as const)('%s: pagina automáticamente con muchas líneas', async (plantilla) => {
      const lineas = Array.from({ length: 80 }, (_, i) => ({ concepto: `Producto ${i}`, cantidad: '1', precioUnitario: '10.00', total: '10.00' }));
      const buffer = await generarDocumentoPdf({ ...PARAMS_BASE, lineas }, { plantilla });

      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });

    it.each(['ECF_OFICIAL', 'MINIMALISTA', 'COMPACTO', 'EDITORIAL'] as const)('%s: sin mostrarPrecios (remisión) no rompe el documento', async (plantilla) => {
      const buffer = await generarDocumentoPdf(
        { ...PARAMS_BASE, mostrarPrecios: false, lineas: [{ concepto: 'Producto A', cantidad: '2' }] },
        { plantilla },
      );

      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });

    it('CLASICO sigue siendo el default cuando no se pasa `plantilla` — mismo comportamiento de siempre', async () => {
      const buffer = await generarDocumentoPdf(PARAMS_BASE);

      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });

    describe('"Formato de Documentos" — Fase A (campos dinámicos) y Fase B1 (QR/firma genéricos)', () => {
      // PNG 1x1 transparente — ver LOGO_1PX arriba, mismo criterio para firma/QR.
      const IMAGEN_1PX =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

      it.each(['CLASICO', 'ECF_OFICIAL', 'MINIMALISTA', 'COMPACTO', 'EDITORIAL'] as const)('%s: color de marca no rompe el documento', async (plantilla) => {
        const buffer = await generarDocumentoPdf({ ...PARAMS_BASE, colorAcento: '#2b6cb0' }, { plantilla });
        expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      });

      it.each(['CLASICO', 'ECF_OFICIAL', 'MINIMALISTA', 'COMPACTO', 'EDITORIAL'] as const)('%s: oculta campos del emisor que no estén en camposEmisorVisibles', async (plantilla) => {
        const buffer = await generarDocumentoPdf({ ...PARAMS_BASE, camposEmisorVisibles: ['rnc'] }, { plantilla });
        expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      });

      it.each(['CLASICO', 'ECF_OFICIAL', 'MINIMALISTA', 'COMPACTO', 'EDITORIAL'] as const)('%s: dibuja datos extra del cliente cuando se piden', async (plantilla) => {
        const buffer = await generarDocumentoPdf(
          { ...PARAMS_BASE, clienteDatosExtra: { rnc: '101-00000-1', direccion: 'Calle Falsa 123', telefono: '809-000-0000' }, camposClienteVisibles: ['rnc', 'direccion', 'telefono'] },
          { plantilla },
        );
        expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      });

      it.each(['CLASICO', 'ECF_OFICIAL', 'MINIMALISTA', 'COMPACTO', 'EDITORIAL'] as const)('%s: columnasLinea reducidas no rompen la tabla', async (plantilla) => {
        const buffer = await generarDocumentoPdf({ ...PARAMS_BASE, columnasLinea: ['cantidad', 'total'] }, { plantilla });
        expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      });

      it.each(['CLASICO', 'ECF_OFICIAL', 'MINIMALISTA', 'COMPACTO', 'EDITORIAL'] as const)('%s: totalesVisibles reducidos no rompen el bloque de totales', async (plantilla) => {
        const buffer = await generarDocumentoPdf({ ...PARAMS_BASE, totalesVisibles: ['total'] }, { plantilla });
        expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      });

      it.each(['CLASICO', 'ECF_OFICIAL', 'MINIMALISTA', 'COMPACTO', 'EDITORIAL'] as const)('%s: QR genérico no rompe el documento', async (plantilla) => {
        const buffer = await generarDocumentoPdf({ ...PARAMS_BASE, qr: { dataUri: IMAGEN_1PX, etiqueta: 'Escanea para pagar' } }, { plantilla });
        expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      });

      it.each(['CLASICO', 'ECF_OFICIAL', 'MINIMALISTA', 'COMPACTO', 'EDITORIAL'] as const)('%s: firma con imagen no rompe el documento', async (plantilla) => {
        const buffer = await generarDocumentoPdf({ ...PARAMS_BASE, firma: { etiqueta: 'Autorizado por', imagen: IMAGEN_1PX } }, { plantilla });
        expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      });

      it.each(['CLASICO', 'ECF_OFICIAL', 'MINIMALISTA', 'COMPACTO', 'EDITORIAL'] as const)('%s: QR y firma juntos no rompen el documento', async (plantilla) => {
        const buffer = await generarDocumentoPdf(
          { ...PARAMS_BASE, qr: { dataUri: IMAGEN_1PX }, firma: { etiqueta: 'Autorizado por' } },
          { plantilla },
        );
        expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      });

      it('ECF_OFICIAL sin firma explícita sigue dibujando la línea "Elaborado por" de siempre (sin cambio de comportamiento)', async () => {
        const buffer = await generarDocumentoPdf(PARAMS_BASE, { plantilla: 'ECF_OFICIAL' });
        expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      });

      it('sin ninguno de los campos nuevos, el documento es idéntico en forma al comportamiento previo (regresión)', async () => {
        const buffer = await generarDocumentoPdf(PARAMS_BASE, { plantilla: 'CLASICO' });
        expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      });
    });
  });
});
