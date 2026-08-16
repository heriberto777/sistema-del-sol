export function descargarBlob(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

/** Para blobs "para ver" (ej. un PDF) en vez de forzar la descarga — abre en una pestaña nueva. */
export function abrirBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // No se revoca de inmediato: la pestaña nueva necesita la URL viva mientras la usa.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
