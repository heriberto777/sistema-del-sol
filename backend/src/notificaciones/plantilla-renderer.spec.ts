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
});
