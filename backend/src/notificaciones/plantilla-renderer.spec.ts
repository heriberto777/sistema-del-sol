import { renderizarPlantilla } from './plantilla-renderer';

describe('renderizarPlantilla', () => {
  it('reemplaza una variable simple', () => {
    expect(renderizarPlantilla('Hola {{nombre}}', { nombre: 'Juan' })).toBe('Hola Juan');
  });

  it('reemplaza múltiples variables', () => {
    const resultado = renderizarPlantilla('{{cliente}} debe {{total}}', {
      cliente: 'Ana',
      total: 'RD$500',
    });
    expect(resultado).toBe('Ana debe RD$500');
  });

  it('tolera espacios dentro de las llaves', () => {
    expect(renderizarPlantilla('Hola {{  nombre  }}', { nombre: 'Juan' })).toBe('Hola Juan');
  });

  it('deja intacto el placeholder si la variable no existe', () => {
    expect(renderizarPlantilla('Hola {{nombre}}', {})).toBe('Hola {{nombre}}');
  });

  it('no se confunde por propiedades heredadas del prototipo (hasOwnProperty)', () => {
    expect(renderizarPlantilla('{{toString}}', {})).toBe('{{toString}}');
  });

  it('reemplaza la misma variable repetida varias veces', () => {
    expect(renderizarPlantilla('{{x}} y {{x}}', { x: '1' })).toBe('1 y 1');
  });

  describe('escape de HTML (hallazgo de la auditoría de XSS)', () => {
    it('escapa una etiqueta HTML inyectada en el valor de una variable', () => {
      const resultado = renderizarPlantilla('Hola {{nombre}}', { nombre: '<img src=x onerror=alert(1)>' });
      expect(resultado).toBe('Hola &lt;img src=x onerror=alert(1)&gt;');
    });

    it('escapa comillas y ampersand', () => {
      const resultado = renderizarPlantilla('{{x}}', { x: `"'&` });
      expect(resultado).toBe('&quot;&#39;&amp;');
    });

    it('el placeholder de una variable inexistente sigue intacto (no hay nada que escapar)', () => {
      expect(renderizarPlantilla('Hola {{nombre}}', {})).toBe('Hola {{nombre}}');
    });

    it('un link armado por el propio backend pasa igual por el escape, sin romperse (no tiene caracteres especiales)', () => {
      const resultado = renderizarPlantilla('<a href="{{link}}">Ver</a>', { link: 'https://app.ejemplo.com/ver-factura/abc-123' });
      expect(resultado).toBe('<a href="https://app.ejemplo.com/ver-factura/abc-123">Ver</a>');
    });
  });
});
