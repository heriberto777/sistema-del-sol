import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformAdminPayload } from './platform-authenticated-request';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { OlvidePasswordPlataformaDto } from './dto/olvide-password-plataforma.dto';
import { RestablecerPasswordPlataformaDto } from './dto/restablecer-password-plataforma.dto';
import { generarTokenReset, hashearTokenReset, RESET_PASSWORD_TTL_MS } from '../common/utils/password-reset-token';
import { EmailChannel } from '../notificaciones/canales/email.channel';

const RESPUESTA_GENERICA_OLVIDE = {
  mensaje: 'Si el correo existe, se envió un enlace para restablecer la contraseña.',
};

@Injectable()
export class PlatformAuthService {
  private readonly logger = new Logger(PlatformAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailChannel: EmailChannel,
  ) {}

  async login({ email, password }: PlatformLoginDto) {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { email } });
    if (!admin || !admin.activo || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload: PlatformAdminPayload = { adminId: admin.id, email: admin.email };
    return {
      accessToken: this.jwtService.sign(payload, {
        secret: process.env.PLATFORM_JWT_SECRET ?? 'cambia-este-secreto-de-plataforma-en-produccion',
        expiresIn: process.env.PLATFORM_JWT_EXPIRATION ?? '12h',
      }),
      admin: { id: admin.id, nombre: admin.nombre, email: admin.email },
    };
  }

  async olvidePassword(dto: OlvidePasswordPlataformaDto) {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { email: dto.email } });
    if (!admin || !admin.activo) return RESPUESTA_GENERICA_OLVIDE;

    const { token, tokenHash } = generarTokenReset();
    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { resetPasswordTokenHash: tokenHash, resetPasswordExpiraEn: new Date(Date.now() + RESET_PASSWORD_TTL_MS) },
    });

    const enlace = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/plataforma/restablecer-password?token=${token}`;
    this.logger.debug(`Enlace de restablecimiento para ${admin.email}: ${enlace}`);
    await this.emailChannel.enviar(
      admin.email,
      'Restablece tu contraseña — Plataforma El Sistema del Sol',
      `<p>Solicitaste restablecer tu contraseña de plataforma.</p><p><a href="${enlace}">Haz clic aquí para continuar</a></p><p>Este enlace vence en 1 hora. Si no fuiste tú, ignora este correo.</p>`,
    );

    return RESPUESTA_GENERICA_OLVIDE;
  }

  async restablecerPassword(dto: RestablecerPasswordPlataformaDto) {
    const tokenHash = hashearTokenReset(dto.token);
    const admin = await this.prisma.platformAdmin.findFirst({
      where: { resetPasswordTokenHash: tokenHash, resetPasswordExpiraEn: { gt: new Date() } },
    });
    if (!admin) throw new BadRequestException('Token inválido o vencido');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { passwordHash, resetPasswordTokenHash: null, resetPasswordExpiraEn: null },
    });

    return { mensaje: 'Contraseña actualizada correctamente' };
  }
}
