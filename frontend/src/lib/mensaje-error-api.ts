/**
 * Extrae el mensaje real de un error de axios (`err.response.data.message`,
 * el shape que devuelve `HttpExceptionFilter` en el backend) — `fallback`
 * es el mensaje genérico a usar SOLO cuando el backend no mandó nada más
 * específico (network error, CORS, etc.), nunca un texto que reemplace un
 * mensaje real ya disponible. Antes de este helper, la mayoría de los
 * formularios de la app usaban `onError: () => setError('texto fijo')`
 * ignorando el error real por completo — un mismo mensaje adivinado se
 * mostraba sin importar la causa real del fallo (bug real, encontrado en
 * Productos.tsx: un producto con varias fotos fallaba por límite de
 * tamaño del body, pero mostraba un mensaje sobre combos).
 */
export function mensajeErrorApi(err: unknown, fallback: string): string {
  const mensaje =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
      : undefined;
  return (Array.isArray(mensaje) ? mensaje[0] : mensaje) ?? fallback;
}
