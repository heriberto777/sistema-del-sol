import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { TipoCodigoAutorizacion } from '@prisma/client';
import { AutorizacionesRepository } from './autorizaciones.repository';
import { EmailChannel } from '../notificaciones/canales/email.channel';
import { ConfiguracionesService } from '../configuraciones/configuraciones.service';

const TTL_CODIGO_MS = 5 * 60 * 1000;
const INTENTOS_MAX = 5;

export const CLAVE_2FA_ANULAR = 'AUTORIZACION_2FA_ANULAR';
export const CLAVE_2FA_DEVOLUCION = 'AUTORIZACION_2FA_DEVOLUCION';

function generarCodigo(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** `he***@gmail.com` — mismo criterio que Cuadre muestra en su pantalla "Verificar Código" ("enviado a: Fulano - he***@gmail.com"), sin revelar el email completo en la respuesta HTTP. */
function ofuscarEmail(email: string): string {
  const [usuario, dominio] = email.split('@');
  if (!dominio) return email;
  const visible = usuario.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(usuario.length - 2, 1))}@${dominio}`;
}

/**
 * Segunda capa de autorización (plan de integración Cuadre, ítem D-1) —
 * opcional por tenant, complementa (no reemplaza) el PIN autoservicio de
 * Fase 9. A diferencia del PIN, el código lo recibe un TERCERO real por
 * email (encargado de la sucursal, o Admin Total si no hay uno
 * asignado — ver AutorizacionesRepository.resolverDestinatarios), nunca
 * el mismo usuario que solicita la acción.
 */
@Injectable()
export class AutorizacionesService {
  constructor(
    private readonly repository: AutorizacionesRepository,
    private readonly emailChannel: EmailChannel,
    private readonly configuracionesService: ConfiguracionesService,
  ) {}

  /** Toggle simple por tenant, sin umbral de monto (decisión del usuario) — ver CLAVE_2FA_ANULAR/CLAVE_2FA_DEVOLUCION. */
  async estaHabilitada(tipo: TipoCodigoAutorizacion, tenantId: string): Promise<boolean> {
    const clave = tipo === 'ANULACION_FACTURA' ? CLAVE_2FA_ANULAR : CLAVE_2FA_DEVOLUCION;
    return (await this.configuracionesService.buscarValor(clave, tenantId, 'false')) === 'true';
  }

  async solicitar(params: {
    tenantId: string;
    tipo: TipoCodigoAutorizacion;
    referenciaId: string;
    sucursalId: string | null;
    solicitadoPorId: string;
    monto: number;
    descripcion: string;
  }): Promise<{ expiraEn: Date; enviadoA: string[] }> {
    const destinatarios = await this.repository.resolverDestinatarios(params.sucursalId);
    if (destinatarios.length === 0) {
      throw new BadRequestException('No hay ningún encargado ni Admin Total al que enviarle el código de autorización');
    }

    await this.repository.invalidarPendientes(params.tipo, params.referenciaId);

    const codigo = generarCodigo();
    const codigoHash = await bcrypt.hash(codigo, 10);
    const expiraEn = new Date(Date.now() + TTL_CODIGO_MS);
    await this.repository.crear({
      tenantId: params.tenantId,
      tipo: params.tipo,
      referenciaId: params.referenciaId,
      codigoHash,
      expiraEn,
      solicitadoPorId: params.solicitadoPorId,
    });

    const asunto = 'Código de autorización — El Sistema del Sol';
    const cuerpo = `<p>Se solicitó autorización para: <strong>${params.descripcion}</strong> (monto RD$ ${params.monto.toFixed(2)}).</p><p>Código: <strong style="font-size:1.5em">${codigo}</strong></p><p>Vence en 5 minutos. Si no reconocés esta solicitud, ignorá este correo.</p>`;
    await Promise.all(destinatarios.map((d) => this.emailChannel.enviar(d.email, asunto, cuerpo)));

    return { expiraEn, enviadoA: destinatarios.map((d) => ofuscarEmail(d.email)) };
  }

  async verificar(tipo: TipoCodigoAutorizacion, referenciaId: string, codigo?: string): Promise<void> {
    const pendiente = await this.repository.buscarPendiente(tipo, referenciaId);
    if (!pendiente) {
      throw new BadRequestException('No hay un código de autorización pendiente — solicitá uno nuevo');
    }
    if (pendiente.expiraEn < new Date()) {
      throw new BadRequestException('El código de autorización venció — solicitá uno nuevo');
    }
    if (pendiente.intentosFallidos >= INTENTOS_MAX) {
      throw new ForbiddenException('Se agotaron los intentos para este código — solicitá uno nuevo');
    }

    if (!codigo || !(await bcrypt.compare(codigo, pendiente.codigoHash))) {
      await this.repository.registrarIntentoFallido(pendiente.id, pendiente.intentosFallidos + 1);
      throw new ForbiddenException('Código de autorización incorrecto');
    }

    await this.repository.marcarUsado(pendiente.id);
  }
}
