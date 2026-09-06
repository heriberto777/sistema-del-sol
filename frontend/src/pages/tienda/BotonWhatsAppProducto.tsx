import { MessageCircle } from 'lucide-react';
import { formatearPrecio } from '../../hooks/useTienda';

/**
 * Botón "Preguntar por WhatsApp" en la ficha de producto — pedido
 * explícito del usuario. Deliberadamente NO usa Twilio ni el bot
 * conversacional (`whatsapp-config`/`whatsapp-bot`, ver backend): esos
 * dos existen para flujos distintos (notificación saliente de la
 * plataforma, y el bot que responde mensajes ENTRANTES al número del
 * tenant) — acá el comprador es quien inicia la conversación, así que
 * alcanza con un link `wa.me` de click-to-chat, sin backend de por medio.
 * WhatsApp no permite adjuntar la imagen del producto vía este link
 * (limitación de la API de click-to-chat, no de este componente) — el
 * link a la ficha del producto queda en el texto como sustituto.
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
  if (!numero) return null;

  const url = `${window.location.origin}/tienda/${subdominio}/producto/${productoId}`;
  const mensaje = `Hola! Quiero más información sobre *${nombreProducto}* (${formatearPrecio(precio)}): ${url}`;

  return (
    <a
      href={`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      <MessageCircle size={15} />
      Preguntar por WhatsApp
    </a>
  );
}
