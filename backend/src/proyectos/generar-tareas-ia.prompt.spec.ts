import { ServiceUnavailableException } from '@nestjs/common';
import { construirPromptGenerarTareas, parsearTareasSugeridas } from './generar-tareas-ia.prompt';

describe('construirPromptGenerarTareas', () => {
  it('incluye el nombre y la descripción del proyecto en el prompt', () => {
    const prompt = construirPromptGenerarTareas('Remodelación local Piantini', 'Remodelar sala de ventas y bodega');
    expect(prompt).toContain('Remodelación local Piantini');
    expect(prompt).toContain('Remodelar sala de ventas y bodega');
  });
});

describe('parsearTareasSugeridas', () => {
  it('parsea una lista válida', () => {
    const texto = '{"tareas":[{"titulo":"Cotizar materiales","prioridad":"ALTA"},{"titulo":"Contratar electricista","prioridad":"MEDIA"}]}';
    expect(parsearTareasSugeridas(texto)).toEqual([
      { titulo: 'Cotizar materiales', prioridad: 'ALTA' },
      { titulo: 'Contratar electricista', prioridad: 'MEDIA' },
    ]);
  });

  it('ignora texto/markdown alrededor del JSON (defensivo, la IA a veces lo envuelve pese a la instrucción)', () => {
    const texto = 'Acá tenés las tareas:\n```json\n{"tareas":[{"titulo":"Cotizar materiales","prioridad":"ALTA"}]}\n```\nEspero que sirva.';
    expect(parsearTareasSugeridas(texto)).toEqual([{ titulo: 'Cotizar materiales', prioridad: 'ALTA' }]);
  });

  it('una prioridad no reconocida cae a MEDIA en vez de descartar la tarea', () => {
    const texto = '{"tareas":[{"titulo":"Tarea rara","prioridad":"SUPER_URGENTE"}]}';
    expect(parsearTareasSugeridas(texto)).toEqual([{ titulo: 'Tarea rara', prioridad: 'MEDIA' }]);
  });

  it('una prioridad ausente cae a MEDIA', () => {
    const texto = '{"tareas":[{"titulo":"Sin prioridad"}]}';
    expect(parsearTareasSugeridas(texto)).toEqual([{ titulo: 'Sin prioridad', prioridad: 'MEDIA' }]);
  });

  it('descarta ítems sin título', () => {
    const texto = '{"tareas":[{"titulo":"","prioridad":"ALTA"},{"titulo":"Válida","prioridad":"BAJA"}]}';
    expect(parsearTareasSugeridas(texto)).toEqual([{ titulo: 'Válida', prioridad: 'BAJA' }]);
  });

  it('recorta a un máximo de 12 tareas', () => {
    const tareas = Array.from({ length: 20 }, (_, i) => ({ titulo: `Tarea ${i}`, prioridad: 'MEDIA' }));
    const texto = JSON.stringify({ tareas });
    expect(parsearTareasSugeridas(texto)).toHaveLength(12);
  });

  it('rechaza si no hay ningún JSON reconocible en el texto', () => {
    expect(() => parsearTareasSugeridas('esto no es JSON para nada')).toThrow(ServiceUnavailableException);
  });

  it('rechaza si el JSON no tiene la forma esperada (sin campo tareas)', () => {
    expect(() => parsearTareasSugeridas('{"otraCosa":[1,2,3]}')).toThrow(ServiceUnavailableException);
  });

  it('rechaza si "tareas" viene vacío', () => {
    expect(() => parsearTareasSugeridas('{"tareas":[]}')).toThrow(ServiceUnavailableException);
  });

  it('rechaza si todos los ítems quedan sin título tras filtrar', () => {
    expect(() => parsearTareasSugeridas('{"tareas":[{"titulo":""},{"titulo":"   "}]}')).toThrow(ServiceUnavailableException);
  });
});
