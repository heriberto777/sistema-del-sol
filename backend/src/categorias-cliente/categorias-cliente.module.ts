import { Module } from '@nestjs/common';
import { CategoriasClienteService } from './categorias-cliente.service';
import { CategoriasClienteController } from './categorias-cliente.controller';
import { CategoriasClienteRepository } from './categorias-cliente.repository';

@Module({
  controllers: [CategoriasClienteController],
  providers: [CategoriasClienteService, CategoriasClienteRepository],
  exports: [CategoriasClienteService, CategoriasClienteRepository],
})
export class CategoriasClienteModule {}
