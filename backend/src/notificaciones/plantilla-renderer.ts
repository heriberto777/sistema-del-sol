export function renderizarPlantilla(cuerpo: string, variables: Record<string, string>): string {
  return cuerpo.replace(/{{\s*(\w+)\s*}}/g, (coincidencia, nombreVariable) =>
    Object.prototype.hasOwnProperty.call(variables, nombreVariable) ? variables[nombreVariable] : coincidencia,
  );
}
