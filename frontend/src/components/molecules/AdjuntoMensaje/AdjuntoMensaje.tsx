import { FileText } from 'lucide-react';

const EXTENSIONES_IMAGEN: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

function mimeDesdeNombre(nombre: string): string | null {
  const ext = nombre.split('.').pop()?.toLowerCase();
  return (ext && EXTENSIONES_IMAGEN[ext]) ?? null;
}

/** Adjunto de un mensaje de Soporte — thumbnail si es imagen (por extensión del nombre), link de descarga genérico si no. Mismo patrón base64-en-Postgres que `ImagenProducto`, sin storage externo. */
export function AdjuntoMensaje({ base64, nombre }: { base64: string; nombre: string }) {
  const mime = mimeDesdeNombre(nombre);
  const dataUrl = `data:${mime ?? 'application/octet-stream'};base64,${base64}`;

  if (mime) {
    return (
      <a href={dataUrl} target="_blank" rel="noreferrer" className="mt-1.5 block">
        <img src={dataUrl} alt={nombre} className="max-h-48 rounded-lg border border-black/5 object-cover" />
      </a>
    );
  }

  return (
    <a
      href={dataUrl}
      download={nombre}
      className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-black/10 bg-black/5 px-2 py-1 text-xs hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
    >
      <FileText size={12} className="shrink-0" />
      <span className="truncate">{nombre}</span>
    </a>
  );
}
