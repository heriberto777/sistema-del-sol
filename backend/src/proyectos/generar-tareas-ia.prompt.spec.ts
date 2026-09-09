import { ServiceUnavailableException } from '@nestjs/common';
import { construirPromptGenerarTareas, parsearPlanSugerido } from './generar-tareas-ia.prompt';

describe('construirPromptGenerarTareas', () => {
  it('incluye el nombre y la descripción del proyecto en el prompt', () => {
    const prompt = construirPromptGenerarTareas('Remodelación local Piantini', 'Remodelar sala de ventas y bodega');
    expect(prompt).toContain('Remodelación local Piantini');
    expect(prompt).toContain('Remodelar sala de ventas y bodega');
  });
});

describe('parsearPlanSugerido', () => {
  it('parsea hitos con sus tareas agrupadas y tareas sueltas', () => {
    const texto = JSON.stringify({
      hitos: [
        { nombre: 'Entrega de planos', tareas: [{ titulo: 'Cotizar materiales', prioridad: 'ALTA' }] },
        { nombre: 'Instalación eléctrica', tareas: [{ titulo: 'Contratar electricista', prioridad: 'MEDIA' }] },
      ],
      tareasSinHito: [{ titulo: 'Firmar contrato', prioridad: 'BAJA' }],
    });
    expect(parsearPlanSugerido(texto)).toEqual({
      hitos: [
        { nombre: 'Entrega de planos', tareas: [{ titulo: 'Cotizar materiales', prioridad: 'ALTA' }] },
        { nombre: 'Instalación eléctrica', tareas: [{ titulo: 'Contratar electricista', prioridad: 'MEDIA' }] },
      ],
      tareasSinHito: [{ titulo: 'Firmar contrato', prioridad: 'BAJA' }],
    });
  });

  it('acepta un plan sin hitos, solo tareas sueltas (proyecto simple, sin entregas diferenciadas)', () => {
    const texto = JSON.stringify({ hitos: [], tareasSinHito: [{ titulo: 'Tarea única', prioridad: 'MEDIA' }] });
    expect(parsearPlanSugerido(texto)).toEqual({ hitos: [], tareasSinHito: [{ titulo: 'Tarea única', prioridad: 'MEDIA' }] });
  });

  it('acepta un hito sin ninguna tarea (shell vacío, el usuario agrega tareas después)', () => {
    const texto = JSON.stringify({ hitos: [{ nombre: 'Hito vacío', tareas: [] }], tareasSinHito: [] });
    expect(parsearPlanSugerido(texto)).toEqual({ hitos: [{ nombre: 'Hito vacío', tareas: [] }], tareasSinHito: [] });
  });

  it('ignora texto/markdown alrededor del JSON (defensivo, la IA a veces lo envuelve pese a la instrucción)', () => {
    const texto = 'Acá tenés el plan:\n```json\n{"hitos":[],"tareasSinHito":[{"titulo":"Cotizar materiales","prioridad":"ALTA"}]}\n```\nEspero que sirva.';
    expect(parsearPlanSugerido(texto)).toEqual({ hitos: [], tareasSinHito: [{ titulo: 'Cotizar materiales', prioridad: 'ALTA' }] });
  });

  it('descarta un hito sin nombre (aunque tenga tareas válidas)', () => {
    const texto = JSON.stringify({ hitos: [{ nombre: '', tareas: [{ titulo: 'x', prioridad: 'ALTA' }] }], tareasSinHito: [] });
    expect(() => parsearPlanSugerido(texto)).toThrow(ServiceUnavailableException);
  });

  it('una prioridad no reconocida cae a MEDIA en vez de descartar la tarea', () => {
    const texto = JSON.stringify({ hitos: [], tareasSinHito: [{ titulo: 'Tarea rara', prioridad: 'SUPER_URGENTE' }] });
    expect(parsearPlanSugerido(texto).tareasSinHito).toEqual([{ titulo: 'Tarea rara', prioridad: 'MEDIA' }]);
  });

  it('una prioridad ausente cae a MEDIA', () => {
    const texto = JSON.stringify({ hitos: [], tareasSinHito: [{ titulo: 'Sin prioridad' }] });
    expect(parsearPlanSugerido(texto).tareasSinHito).toEqual([{ titulo: 'Sin prioridad', prioridad: 'MEDIA' }]);
  });

  it('descarta tareas sin título, dentro de un hito y sueltas', () => {
    const texto = JSON.stringify({
      hitos: [{ nombre: 'Hito', tareas: [{ titulo: '', prioridad: 'ALTA' }, { titulo: 'Válida', prioridad: 'BAJA' }] }],
      tareasSinHito: [{ titulo: '' }, { titulo: 'Suelta válida' }],
    });
    const resultado = parsearPlanSugerido(texto);
    expect(resultado.hitos[0].tareas).toEqual([{ titulo: 'Válida', prioridad: 'BAJA' }]);
    expect(resultado.tareasSinHito).toEqual([{ titulo: 'Suelta válida', prioridad: 'MEDIA' }]);
  });

  it('recorta a un máximo de 6 hitos y 8 tareas por hito', () => {
    const hitos = Array.from({ length: 10 }, (_, i) => ({
      nombre: `Hito ${i}`,
      tareas: Array.from({ length: 15 }, (_, j) => ({ titulo: `Tarea ${j}`, prioridad: 'MEDIA' })),
    }));
    const resultado = parsearPlanSugerido(JSON.stringify({ hitos, tareasSinHito: [] }));
    expect(resultado.hitos).toHaveLength(6);
    expect(resultado.hitos[0].tareas).toHaveLength(8);
  });

  it('recorta las tareas sueltas a un máximo de 8', () => {
    const tareasSinHito = Array.from({ length: 15 }, (_, i) => ({ titulo: `Tarea ${i}`, prioridad: 'MEDIA' }));
    const resultado = parsearPlanSugerido(JSON.stringify({ hitos: [], tareasSinHito }));
    expect(resultado.tareasSinHito).toHaveLength(8);
  });

  it('rechaza si no hay ningún JSON reconocible en el texto', () => {
    expect(() => parsearPlanSugerido('esto no es JSON para nada')).toThrow(ServiceUnavailableException);
  });

  it('rechaza si no queda ni un hito ni una tarea suelta usable', () => {
    expect(() => parsearPlanSugerido('{"hitos":[],"tareasSinHito":[]}')).toThrow(ServiceUnavailableException);
  });

  it('rechaza si el JSON no tiene ninguno de los dos campos esperados', () => {
    expect(() => parsearPlanSugerido('{"otraCosa":[1,2,3]}')).toThrow(ServiceUnavailableException);
  });
});
