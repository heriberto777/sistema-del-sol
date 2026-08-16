import { useState } from 'react';
import { apiClient } from '../../../lib/api-client';
import { descargarBlob } from '../../../lib/descargar-archivo';
import { Button } from '../../atoms/Button/Button';

interface BotonesExportarProps {
  endpoint: string;
  params?: Record<string, string | undefined>;
  nombreBase: string;
}

export function BotonesExportar({ endpoint, params, nombreBase }: BotonesExportarProps) {
  const [descargando, setDescargando] = useState<'xlsx' | 'pdf' | null>(null);

  async function exportar(formato: 'xlsx' | 'pdf') {
    setDescargando(formato);
    try {
      const respuesta = await apiClient.get(endpoint, {
        params: { ...params, formato },
        responseType: 'blob',
      });
      descargarBlob(respuesta.data, `${nombreBase}.${formato}`);
    } finally {
      setDescargando(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variante="secundario" disabled={descargando !== null} onClick={() => exportar('xlsx')}>
        {descargando === 'xlsx' ? 'Generando…' : 'Exportar Excel'}
      </Button>
      <Button variante="secundario" disabled={descargando !== null} onClick={() => exportar('pdf')}>
        {descargando === 'pdf' ? 'Generando…' : 'Exportar PDF'}
      </Button>
    </div>
  );
}
