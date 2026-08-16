import { Button } from '../../atoms/Button/Button';

interface PaginacionProps {
  pagina: number;
  tamanoPagina: number;
  total: number;
  onCambiarPagina: (pagina: number) => void;
}

export function Paginacion({ pagina, tamanoPagina, total, onCambiarPagina }: PaginacionProps) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanoPagina));
  const desde = total === 0 ? 0 : (pagina - 1) * tamanoPagina + 1;
  const hasta = Math.min(pagina * tamanoPagina, total);

  return (
    <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
      <span>
        {total === 0 ? 'Sin resultados' : `Mostrando ${desde}–${hasta} de ${total}`}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variante="secundario"
          disabled={pagina <= 1}
          onClick={() => onCambiarPagina(pagina - 1)}
        >
          Anterior
        </Button>
        <span>
          Página {pagina} de {totalPaginas}
        </span>
        <Button
          variante="secundario"
          disabled={pagina >= totalPaginas}
          onClick={() => onCambiarPagina(pagina + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
