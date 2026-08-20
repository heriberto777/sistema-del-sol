import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { EstablecerPinDto } from './dto/establecer-pin.dto';
import { EliminarPinDto } from './dto/eliminar-pin.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { LoginDto } from './dto/login.dto';
import { OlvidePasswordDto } from './dto/olvide-password.dto';
import { RestablecerPasswordDto } from './dto/restablecer-password.dto';
import { generarTokenReset, hashearTokenReset, RESET_PASSWORD_TTL_MS } from '../common/utils/password-reset-token';
import { EmailChannel } from '../notificaciones/canales/email.channel';
import { resolverModulosActivos } from '../planes/resolver-modulos-activos';

const RESPUESTA_GENERICA_OLVIDE = {
  mensaje: 'Si el correo existe, se envió un enlace para restablecer la contraseña.',
};

// Fase 9 (adopción de Cuadre): PIN corto de confirmación para acciones
// sensibles. Sin freno de fuerza bruta, un PIN de 4-6 dígitos sería un
// hueco real dado que gatea acciones como anular facturas.
const PIN_INTENTOS_MAX = 5;
const PIN_BLOQUEO_MS = 15 * 60 * 1000;
const PIN_REGEX = /^\d{4,6}$/;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailChannel: EmailChannel,
  ) {}

  /** Primer paso del login: a qué empresa(s) pertenece este email, para que el usuario no tenga que saber el subdominio de memoria. */
  async resolverEmpresas(email: string) {
    const usuarios = await this.prisma.user.findMany({
      where: { email, activo: true, tenant: { estado: 'ACTIVO' } },
      include: { tenant: true },
    });

    return {
      empresas: usuarios.map((u) => ({ subdominio: u.tenant.subdominio, nombre: u.tenant.nombre })),
    };
  }

  async login({ email, password, tenantSubdominio }: LoginDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { subdominio: tenantSubdominio } });
    if (!tenant || tenant.estado !== 'ACTIVO') {
      throw new UnauthorizedException('Tenant no encontrado o inactivo');
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      include: { roles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
    });
    if (!user || !user.activo || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const roles = user.roles.map((userRole) => userRole.role.nombre);
    const permisos = Array.from(
      new Set(
        user.roles.flatMap((userRole) =>
          userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.clave),
        ),
      ),
    );

    const payload: JwtPayloadUser = {
      userId: user.id,
      tenantId: tenant.id,
      email: user.email,
      roles,
      permisos,
    };

    const modulosActivos = await resolverModulosActivos(this.prisma, tenant.id);

    return {
      accessToken: this.jwtService.sign(payload),
      // `permisos`/`modulosActivos` viajan también acá (no solo dentro del
      // JWT) para que el frontend pueda ocultar rutas/botones según permiso
      // y plan real sin tener que decodificar el token — la aplicación real
      // de ambos sigue siendo 100% responsabilidad de los guards del
      // backend (PermissionsGuard/ModuloActivoGuard), esto es solo para no
      // mostrarle al usuario acciones que el servidor le va a rechazar con
      // 403.
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        roles,
        permisos,
        modulosActivos,
        // Solo para que el frontend decida si muestra el modal de PIN en
        // acciones sensibles (Fase 9) — la validación real es 100% del
        // backend (verificarPin), igual criterio que modulosActivos.
        tienePin: !!user.pinHash,
        tenant: { subdominio: tenant.subdominio, nombre: tenant.nombre },
      },
    };
  }

  /** Siempre responde con el mismo mensaje genérico, exista o no el correo, para no filtrar qué emails están registrados. */
  async olvidePassword(dto: OlvidePasswordDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { subdominio: dto.tenantSubdominio } });
    if (!tenant || tenant.estado !== 'ACTIVO') return RESPUESTA_GENERICA_OLVIDE;

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: dto.email } },
    });
    if (!user || !user.activo) return RESPUESTA_GENERICA_OLVIDE;

    const { token, tokenHash } = generarTokenReset();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordTokenHash: tokenHash, resetPasswordExpiraEn: new Date(Date.now() + RESET_PASSWORD_TTL_MS) },
    });

    const enlace = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/restablecer-password?token=${token}&tenant=${tenant.subdominio}`;
    this.logger.debug(`Enlace de restablecimiento para ${user.email}: ${enlace}`);
    await this.emailChannel.enviar(
      user.email,
      'Restablece tu contraseña — El Sistema del Sol',
      `<p>Solicitaste restablecer tu contraseña.</p><p><a href="${enlace}">Haz clic aquí para continuar</a></p><p>Este enlace vence en 1 hora. Si no fuiste tú, ignora este correo.</p>`,
    );

    return RESPUESTA_GENERICA_OLVIDE;
  }

  async restablecerPassword(dto: RestablecerPasswordDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { subdominio: dto.tenantSubdominio } });
    if (!tenant) throw new BadRequestException('Token inválido o vencido');

    const tokenHash = hashearTokenReset(dto.token);
    const user = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id, resetPasswordTokenHash: tokenHash, resetPasswordExpiraEn: { gt: new Date() } },
    });
    if (!user) throw new BadRequestException('Token inválido o vencido');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetPasswordTokenHash: null, resetPasswordExpiraEn: null },
    });

    return { mensaje: 'Contraseña actualizada correctamente' };
  }

  /** Autoservicio — probar la contraseña completa antes de fijar el atajo corto (mismo criterio que cambiar contraseña). */
  async establecerPin(userId: string, dto: EstablecerPinDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    // ForbiddenException (403), no Unauthorized (401): el usuario YA está
    // autenticado con un JWT válido — un 401 acá dispara el interceptor
    // global del frontend que asume sesión vencida y cierra sesión sola
    // (bug real encontrado en la verificación manual de esta fase).
    if (!(await bcrypt.compare(dto.passwordActual, user.passwordHash))) {
      throw new ForbiddenException('Contraseña actual incorrecta');
    }
    if (!PIN_REGEX.test(dto.pin)) {
      throw new BadRequestException('El PIN debe tener entre 4 y 6 dígitos numéricos');
    }

    const pinHash = await bcrypt.hash(dto.pin, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { pinHash, pinIntentosFallidos: 0, pinBloqueadoHasta: null },
    });

    return { mensaje: 'PIN configurado correctamente' };
  }

  async eliminarPin(userId: string, dto: EliminarPinDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(dto.passwordActual, user.passwordHash))) {
      throw new ForbiddenException('Contraseña actual incorrecta');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { pinHash: null, pinIntentosFallidos: 0, pinBloqueadoHasta: null },
    });

    return { mensaje: 'PIN eliminado' };
  }

  /**
   * Confirmación de identidad para acciones sensibles (Fase 9). Sin PIN
   * configurado, no bloquea nada (default permisivo — no puede romper a
   * ningún usuario existente el día del deploy). Con PIN configurado,
   * bloquea 15 minutos tras 5 intentos fallidos consecutivos.
   */
  async verificarPin(userId: string, pin?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.pinHash) return;

    if (user.pinBloqueadoHasta && user.pinBloqueadoHasta > new Date()) {
      throw new ForbiddenException('PIN bloqueado temporalmente por demasiados intentos fallidos — probá de nuevo más tarde');
    }

    if (!pin || !(await bcrypt.compare(pin, user.pinHash))) {
      const intentos = user.pinIntentosFallidos + 1;
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          pinIntentosFallidos: intentos,
          pinBloqueadoHasta: intentos >= PIN_INTENTOS_MAX ? new Date(Date.now() + PIN_BLOQUEO_MS) : null,
        },
      });
      throw new ForbiddenException('PIN incorrecto');
    }

    await this.prisma.user.update({ where: { id: userId }, data: { pinIntentosFallidos: 0, pinBloqueadoHasta: null } });
  }
}
