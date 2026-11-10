import { Module } from '@nestjs/common';
import { ComentariosDocumentoService } from './comentarios-documento.service';
import { ComentariosDocumentoController } from './comentarios-documento.controller';
import { ComentariosDocumentoRepository } from './comentarios-documento.repository';
import { FacturacionModule } from '../facturacion/facturacion.module';
import { CotizacionesModule } from '../cotizaciones/cotizaciones.module';

@Module({
  imports: [FacturacionModule, CotizacionesModule],
  controllers: [ComentariosDocumentoController],
  providers: [ComentariosDocumentoService, ComentariosDocumentoRepository],
})
export class ComentariosDocumentoModule {}
