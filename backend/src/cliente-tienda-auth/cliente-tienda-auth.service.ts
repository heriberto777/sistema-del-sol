import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { resolverTiendaPublica } from '../ecommerce/resolver-tienda-publica';
import { ClienteTiendaPayload } from './cliente-tienda-authenticated-request';
import { CLIENTE_TIENDA_JWT_EXPIRATION, CLIENTE_TIENDA_JWT_SECRET } from './cliente-tienda-jwt.constants';
import { RegistroClienteTiendaDto } from './dto/registro-cliente-tienda.dto';
import { LoginClienteTiendaDto } from './dto/login-cliente-tienda.dto';

type ClienteBasico = { id: string; nombre: string; email: string | null; telefono: string | null };

/**
 * Tercer dominio de auth, completo y paralelo al de tenants
 * (JwtAuthGuard) y plataforma (PlatformAuthGuard) — calco de
 * `platform-auth/`. Cuenta de comprador de UN tenant puntual (resuelto
 * por `:subdominio`, igual criterio que el resto de las rutas
 * públicas de la tienda) — el mismo email puede tener cuenta en varias
 * tiendas de tenants distintos, cada una independiente.
 *
 * Alcance acotado a propósito (Fase 6): registro + login + "Mis
 * pedidos". Recuperar contraseña por email queda FUERA de esta vuelta
 * — se puede sumar después mirror-eando
 * AuthService.olvidePassword/restablecerPassword tal cual.
 */
@Injectable()
export class ClienteTiendaAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async registro(subdominio: string, dto: RegistroClienteTiendaDto) {
    const { tenant } = await resolverTiendaPublica(this.prisma, subdominio);

    // Sin @@unique en Cliente.email (nunca lo tuvo — ver comentario en
    // schema.prisma) — la unicidad de "email CON contraseña" se valida
    // acá, a nivel de servicio, para no arriesgar un constraint de DB
    // que podría chocar con clientes viejos que ya comparten email.
    const existente = await this.prisma.cliente.findFirst({
      where: { tenantId: tenant.id, email: dto.email, passwordHash: { not: null } },
    });
    if (existente) {
      throw new ConflictException('Ya existe una cuenta con ese correo en esta tienda');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const cliente = await this.prisma.cliente.create({
      data: { tenantId: tenant.id, nombre: dto.nombre, email: dto.email, telefono: dto.telefono, passwordHash },
    });

    return this.emitirToken(cliente, tenant.id);
  }

  async login(subdominio: string, dto: LoginClienteTiendaDto) {
    const { tenant } = await resolverTiendaPublica(this.prisma, subdominio);

    const cliente = await this.prisma.cliente.findFirst({
      where: { tenantId: tenant.id, email: dto.email, passwordHash: { not: null } },
    });
    if (!cliente?.passwordHash || !(await bcrypt.compare(dto.password, cliente.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.emitirToken(cliente, tenant.id);
  }

  private emitirToken(cliente: ClienteBasico, tenantId: string) {
    const payload: ClienteTiendaPayload = { clienteId: cliente.id, tenantId, email: cliente.email ?? '' };
    return {
      accessToken: this.jwtService.sign(payload, { secret: CLIENTE_TIENDA_JWT_SECRET, expiresIn: CLIENTE_TIENDA_JWT_EXPIRATION }),
      cliente: { id: cliente.id, nombre: cliente.nombre, email: cliente.email, telefono: cliente.telefono },
    };
  }
}
