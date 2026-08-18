import { useState } from 'react';
import { apiClient } from '../../../lib/api-client';
import { abrirBlob } from '../../../lib/descargar-archivo';
import { FORMATOS_IMPRESION, FormatoImpresion } from '../../../constants/formato-impresion';
import { Modal } from '../Modal/Modal';
import { Select } from '../../atoms/Select/Select';
import { Button } from '../../atoms/Button/Button';

interface ModalImprimirProps {
  /** Ej. `/facturas/${factura.id}` — se le agrega `/imprimir`. */
  urlBase: string;
  titulo: string;
  onClose: () => void;
}

/**
 * Compartido por Facturas/Cotizaciones/Remisiones/POS: el formato vacío
 * deja que el backend resuelva el default (override de bodega > default
 * del tenant > 'CARTA') — siempre se puede cambiar acá sin persistir nada.
 */
export function ModalImprimir({ urlBase, titulo, onClose }: ModalImprimirProps) {
  const [formato, setFormato] = useState<FormatoImpresion | ''>('');
  const [imprimiendo, setImprimiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function imprimir() {
    setImprimiendo(true);
    setError(null);
    try {
      const respuesta = await apiClient.get(`${urlBase}/imprimir`, {
        params: formato ? { formato } : undefined,
        responseType: 'blob',
      });
      const contentType = String(respuesta.headers['content-type'] ?? 'application/pdf');
      abrirBlob(new Blob([respuesta.data], { type: contentType }));
      onClose();
    } catch {
      setError('No se pudo generar el documento.');
    } finally {
      setImprimiendo(false);
    }
  }

  return (
    <Modal titulo={titulo} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Formato</label>
          <Select value={formato} onChange={(e) => setFormato(e.target.value as FormatoImpresion | '')}>
            <option value="">Formato de la empresa (recomendado)</option>
            {FORMATOS_IMPRESION.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={imprimir} disabled={imprimiendo} className="w-full">
          {imprimiendo ? 'Generando…' : 'Imprimir'}
        </Button>
      </div>
    </Modal>
  );
}
