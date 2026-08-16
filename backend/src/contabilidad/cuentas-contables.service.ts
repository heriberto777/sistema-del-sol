import { Injectable } from '@nestjs/common';
import { CuentasContablesRepository } from './cuentas-contables.repository';
import { CrearCuentaContableDto } from './dto/crear-cuenta-contable.dto';

@Injectable()
export class CuentasContablesService {
  constructor(private readonly repository: CuentasContablesRepository) {}

  listar() {
    return this.repository.listar();
  }

  crear(dto: CrearCuentaContableDto, tenantId: string) {
    return this.repository.crear({ ...dto, tenantId });
  }
}
