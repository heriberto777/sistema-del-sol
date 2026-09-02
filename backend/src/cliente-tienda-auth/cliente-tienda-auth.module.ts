import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ClienteTiendaAuthService } from './cliente-tienda-auth.service';
import { ClienteTiendaAuthController } from './cliente-tienda-auth.controller';
import { ClienteTiendaJwtStrategy } from './strategies/cliente-tienda-jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [ClienteTiendaAuthController],
  providers: [ClienteTiendaAuthService, ClienteTiendaJwtStrategy],
})
export class ClienteTiendaAuthModule {}
