import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { obtenerSecretoJwt } from '../common/utils/jwt-secret.util';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: obtenerSecretoJwt('JWT_SECRET'),
      signOptions: { expiresIn: process.env.JWT_EXPIRATION ?? '24h' },
    }),
    NotificacionesModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // AuthService: FacturacionModule/PosModule/InventarioModule lo importan
  // para llamar verificarPin() en las acciones sensibles de Fase 9.
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
