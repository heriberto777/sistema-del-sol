import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { formatearPrecio } from '../../hooks/useTienda';
import { useClienteTienda } from '../../hooks/useClienteTienda';
import { tiendaApiClient } from '../../lib/tienda-api-client';
import { Modal } from '../../components/molecules/Modal/Modal';

/**
 * Botón "Preguntar por WhatsApp" en la ficha de producto — pedido
 * explícito del usuario. Deliberadamente NO usa Twilio ni el bot
 * conversacional (`whatsapp-config`/`whatsapp-bot`, ver backend): esos
 * dos existen para flujos distintos (notificación saliente de la
 * plataforma, y el bot que responde mensajes ENTRANTES al número del
 * tenant) — acá el comprador es quien inicia la conversación, así que
 * alcanza con un link `wa.me` de click-to-chat.
 *
 * CRM "Cotización conectada" Fase 2 — antes de abrir WhatsApp, si no hay
 * ya un comprador logueado con teléfono guardado, pide nombre/teléfono y
 * se los manda al backend (`EcommerceService.consultaWhatsappProducto`)
 * para estructurar un Lead — esto NUNCA bloquea ni demora la apertura de
 * WhatsApp en sí (fire-and-forget, errores silenciosos): si el backend
 * falla, el comprador igual llega al chat.
 */
export function BotonWhatsAppProducto({
  numero,
  nombreProducto,
  precio,
  subdominio,
  productoId,
  className,
}: {
  /** `config.whatsapp` — `null`/`undefined`/vacío = el tenant no lo configuró, no se renderiza nada. */
  numero: string | null | undefined;
  nombreProducto: string;
  precio: string | number | null;
  subdominio: string;
  productoId: string;
  className?: string;
}) {
  const { cliente } = useClienteTienda(subdominio);
  const [pidiendoDatos, setPidiendoDatos] = useState(false);
  const [nombreForm, setNombreForm] = useState('');
  const [telefonoForm, setTelefonoForm] = useState('');

  if (!numero) return null;

  const url = `${window.location.origin}/tienda/${subdominio}/producto/${productoId}`;
  const mensaje = `Hola! Quiero más información sobre *${nombreProducto}* (${formatearPrecio(precio)}): ${url}`;
  const linkWhatsapp = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;

  function registrarConsulta(nombre: string, telefono: string) {
    tiendaApiClient.post(`/tienda/${subdominio}/productos/${productoId}/consulta-whatsapp`, { nombre, telefono, productoNombre: nombreProducto }).catch(() => {
      // Best-effort — nunca le impide al comprador llegar a WhatsApp.
    });
  }

  function abrirWhatsapp() {
    window.open(linkWhatsapp, '_blank', 'noopener,noreferrer');
  }

  function alHacerClick() {
    if (cliente?.telefono) {
      registrarConsulta(cliente.nombre, cliente.telefono);
      abrirWhatsapp();
      return;
    }
    setPidiendoDatos(true);
  }

  function confirmarDatos() {
    if (!nombreForm.trim() || !telefonoForm.trim()) return;
    registrarConsulta(nombreForm.trim(), telefonoForm.trim());
    setPidiendoDatos(false);
    abrirWhatsapp();
  }

  return (
    <>
      <button type="button" onClick={alHacerClick} className={className}>
        <MessageCircle size={15} />
        Preguntar por WhatsApp
      </button>

      {pidiendoDatos && (
        <Modal titulo="Antes de escribirnos" onClose={() => setPidiendoDatos(false)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">Contanos quién sos para que podamos darte seguimiento.</p>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
              <input
                type="text"
                value={nombreForm}
                onChange={(e) => setNombreForm(e.target.value)}
                autoFocus
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Teléfono</label>
              <input
                type="tel"
                value={telefonoForm}
                onChange={(e) => setTelefonoForm(e.target.value)}
                placeholder="809-555-1234"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="button"
              disabled={!nombreForm.trim() || !telefonoForm.trim()}
              onClick={confirmarDatos}
              className="w-full rounded-lg bg-sol-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Continuar a WhatsApp
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
