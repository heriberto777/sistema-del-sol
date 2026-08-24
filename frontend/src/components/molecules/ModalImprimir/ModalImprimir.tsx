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

  // Enviar recibo por email/WhatsApp (plan de integración Cuadre, ítem
  // F-4) — solo existe en el backend para Facturación (recibo de venta),
  // no para Cotizaciones/Remisiones, que ya tienen su propio flujo de
  // envío (ver COTIZACION_ENVIADA).
  const permiteEnviarRecibo = urlBase.startsWith('/facturas/');
  const [canal, setCanal] = useState<'EMAIL' | 'WHATSAPP'>('EMAIL');
  const [destinatario, setDestinatario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensajeEnvio, setMensajeEnvio] = useState<string | null>(null);

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

  async function enviarRecibo() {
    if (!destinatario.trim()) return;
    setEnviando(true);
    setMensajeEnvio(null);
    try {
      const { data } = await apiClient.post<{ enviado: boolean }>(`${urlBase}/enviar-recibo`, { canal, destinatario });
      setMensajeEnvio(
        data.enviado ? 'Recibo enviado.' : 'No hay una plantilla de notificación activa para este canal — configurala en Admin → Notificaciones.',
      );
    } catch {
      setMensajeEnvio('No se pudo enviar el recibo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo={titulo} onClose={onClose}>
      <div className="space-y-4">
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

        {permiteEnviarRecibo && (
          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Enviar recibo</p>
            <div className="flex gap-2">
              {(['EMAIL', 'WHATSAPP'] as const).map((c) => (
                <Button key={c} type="button" variante={canal === c ? 'primario' : 'secundario'} onClick={() => setCanal(c)}>
                  {c === 'EMAIL' ? 'Email' : 'WhatsApp'}
                </Button>
              ))}
            </div>
            <input
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder={canal === 'EMAIL' ? 'correo@ejemplo.com' : '8095551234'}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            {mensajeEnvio && <p className="text-sm text-slate-600 dark:text-slate-400">{mensajeEnvio}</p>}
            <Button onClick={enviarRecibo} disabled={enviando || !destinatario.trim()} className="w-full" variante="secundario">
              {enviando ? 'Enviando…' : 'Enviar'}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
