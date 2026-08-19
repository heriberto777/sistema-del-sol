import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { ClientesRepository } from './clientes.repository';
import { ListasPrecioModule } from '../listas-precio/listas-precio.module';

@Module({
  imports: [ListasPrecioModule],
  controllers: [ClientesController],
  providers: [ClientesService, ClientesRepository],
  exports: [ClientesService],
})
export class ClientesModule {}
