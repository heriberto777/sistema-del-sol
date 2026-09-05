import { ServiceUnavailableException } from '@nestjs/common';
import { parsearCandidatos } from './analizador-imagen.prompt';

describe('parsearCandidatos', () => {
  it('parsea un JSON limpio con 3 opciones', () => {
    const texto = '{"opciones":[{"nombre":"Camisa azul","descripcion":"Camisa de algodón, manga larga."},{"nombre":"Camisa formal","descripcion":"Ideal para oficina."},{"nombre":"Camisa clásica azul","descripcion":"Corte regular, tela liviana."}]}';
    expect(parsearCandidatos(texto, 'Claude')).toEqual([
      { nombre: 'Camisa azul', descripcion: 'Camisa de algodón, manga larga.' },
      { nombre: 'Camisa formal', descripcion: 'Ideal para oficina.' },
      { nombre: 'Camisa clásica azul', descripcion: 'Corte regular, tela liviana.' },
    ]);
  });

  it('extrae el JSON aunque venga envuelto en texto/markdown extra', () => {
    const texto = 'Acá tenés el resultado:\n```json\n{"opciones":[{"nombre":"X","descripcion":"Y"}]}\n```\nEspero que sirva.';
    expect(parsearCandidatos(texto, 'OpenAI')).toEqual([{ nombre: 'X', descripcion: 'Y' }]);
  });

  it('lanza ServiceUnavailableException si no hay ningún JSON en el texto', () => {
    expect(() => parsearCandidatos('no puedo ayudar con eso', 'Gemini')).toThrow(ServiceUnavailableException);
  });

  it('lanza ServiceUnavailableException si el JSON es inválido', () => {
    expect(() => parsearCandidatos('{"opciones": [', 'Claude')).toThrow(ServiceUnavailableException);
  });

  it('lanza ServiceUnavailableException si "opciones" no es un array o está vacío', () => {
    expect(() => parsearCandidatos('{"opciones":[]}', 'Claude')).toThrow(ServiceUnavailableException);
    expect(() => parsearCandidatos('{"algo":"distinto"}', 'Claude')).toThrow(ServiceUnavailableException);
  });

  it('descarta opciones sin nombre (vacío o ausente) pero conserva las demás', () => {
    const texto = '{"opciones":[{"nombre":"","descripcion":"sin nombre"},{"nombre":"Válido","descripcion":"Sí"}]}';
    expect(parsearCandidatos(texto, 'Claude')).toEqual([{ nombre: 'Válido', descripcion: 'Sí' }]);
  });
});
