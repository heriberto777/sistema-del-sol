import { Injectable } from '@nestjs/common';
import { EstadoLead } from '@prisma/client';
import { ContactoTelefonoRepository } from './contacto-telefono.repository';

export type ContactoPorTelefono = { tipo: 'CLIENTE'; id: string; nombre: string } | { tipo: 'LEAD'; id: string; nombre: string; estado: EstadoLead } | { tipo: 'DESCONOCIDO' };

/**
 * "El ancla" del roadmap de "CRM Conectado" — dado el teléfono de una
 * conversación de la Bandeja de WhatsApp, resuelve si ya es un Cliente
 * real, un Lead sin convertir, o ninguno de los dos, para que
 * `ConversacionWhatsapp` pueda ofrecer la acción correcta (armar
 * cotización / ver el lead / crear un lead) sin que el vendedor tenga que
 * ir a buscarlo a mano. Cliente siempre gana sobre Lead (mismo orden de
 * prioridad que LeadsEventosService.alSugerirPedidoWhatsapp).
 */
@Injectable()
export class ContactoTelefonoService {
  constructor(private readonly repository: ContactoTelefonoRepository) {}

  async porTelefono(telefono: string): Promise<ContactoPorTelefono> {
    const cliente = await this.repository.buscarClientePorTelefono(telefono);
    if (cliente) return { tipo: 'CLIENTE', ...cliente };

    const lead = await this.repository.buscarLeadPorTelefono(telefono);
    if (lead) return { tipo: 'LEAD', ...lead };

    return { tipo: 'DESCONOCIDO' };
  }
}
