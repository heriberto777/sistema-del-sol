import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class SucursalesRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(tenantId: string, data: { nombre: string; nombreComercial?: string; telefono?: string; direccion?: string; ciudad?: string }) {
    return this.db.sucursal.create({ data: { tenantId, ...data } });
  }

  listar() {
    return this.db.sucursal.findMany({ where: { activa: true }, orderBy: { nombre: 'asc' } });
  }

  /** Sucursales asignadas a un usuario (Fase 8c, ver AsistenciaController.miEstadoHoy para el mismo criterio de autoservicio). */
  listarAsignadasA(userId: string) {
    return this.db.sucursal.findMany({ where: { activa: true, usuarios: { some: { userId } } }, orderBy: { nombre: 'asc' } });
  }

  contarAsignadasA(userId: string) {
    return this.db.usuarioSucursal.count({ where: { userId } });
  }

  /**
   * Fase 9 — enforcement real (a diferencia de Fase 8, que solo filtraba
   * la UX). Sin ninguna fila en `UsuarioSucursal` para este usuario, sigue
   * el default permisivo de la Fase 8c: puede operar cualquier sucursal.
   * `usuarioSucursal` no tiene columna `tenantId` propia y no está forzado
   * por RLS (mismo criterio que `UserRole`) — no necesita `SET LOCAL`, pero
   * igual expone la variante `EnTx` para participar de la conexión de la
   * transacción abierta por el caller (mismo patrón que `buscarBodegaPorIdEnTx`).
   */
  async usuarioPuedeOperar(userId: string, sucursalId: string): Promise<boolean> {
    const totalAsignadas = await this.db.usuarioSucursal.count({ where: { userId } });
    if (totalAsignadas === 0) return true;
    return (await this.db.usuarioSucursal.count({ where: { userId, sucursalId } })) > 0;
  }

  async usuarioPuedeOperarEnTx(tx: Prisma.TransactionClient, userId: string, sucursalId: string): Promise<boolean> {
    const totalAsignadas = await tx.usuarioSucursal.count({ where: { userId } });
    if (totalAsignadas === 0) return true;
    return (await tx.usuarioSucursal.count({ where: { userId, sucursalId } })) > 0;
  }

  /** Lanza (404) si la sucursal no existe o no pertenece al tenant actual — Sucursal es tenant-scoped, TenantPrismaService inyecta el filtro. */
  buscarPorId(id: string) {
    return this.db.sucursal.findUniqueOrThrow({ where: { id } });
  }

  actualizar(
    id: string,
    data: Partial<{ nombre: string; nombreComercial: string; telefono: string; direccion: string; ciudad: string; activa: boolean }>,
  ) {
    return this.db.sucursal.update({ where: { id }, data });
  }
}
