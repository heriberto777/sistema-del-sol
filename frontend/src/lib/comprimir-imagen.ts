/**
 * Redimensiona y comprime una imagen en el navegador antes de subirla —
 * se guarda como data URI en la base (igual criterio que el logo del
 * tenant), así que conviene llegar liviana. Devuelve un JPEG con el lado
 * más largo acotado a `maxDimension`.
 */
export function comprimirImagen(archivo: File, maxDimension = 640, calidad = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.onload = () => {
      const imagen = new Image();
      imagen.onerror = () => reject(new Error('El archivo no es una imagen válida.'));
      imagen.onload = () => {
        const escala = Math.min(1, maxDimension / Math.max(imagen.width, imagen.height));
        const ancho = Math.round(imagen.width * escala);
        const alto = Math.round(imagen.height * escala);

        const canvas = document.createElement('canvas');
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen.'));
          return;
        }
        ctx.drawImage(imagen, 0, 0, ancho, alto);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      imagen.src = lector.result as string;
    };
    lector.readAsDataURL(archivo);
  });
}
