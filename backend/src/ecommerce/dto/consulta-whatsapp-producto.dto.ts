import { IsNotEmpty, IsString } from 'class-validator';

/**
 * CRM "Cotización conectada" Fase 2 — el botón "Preguntar por WhatsApp"
 * del producto manda esto ANTES de abrir el link `wa.me` (nunca bloquea
 * la apertura, es solo para estructurar el dato). `productoNombre` viaja
 * tal cual lo conoce el frontend (ya lo tiene en pantalla) — no hace
 * falta resolver el producto de nuevo en el backend para esto.
 */
export class ConsultaWhatsappProductoDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  telefono: string;

  @IsString()
  @IsNotEmpty()
  productoNombre: string;
}
