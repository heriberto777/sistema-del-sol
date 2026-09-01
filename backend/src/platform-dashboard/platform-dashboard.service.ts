import { Injectable } from '@nestjs/common';
import { TenantsService } from '../tenants/tenants.service';
import { PlanesService } from '../planes/planes.service';
import { FacturasPlataformaService } from '../facturacion-plataforma/facturas-plataforma.service';

/** Divisor para normalizar un precio ANUAL a una cifra mensual comparable — mismo criterio que usa FacturasPlataformaCronService al generar el cobro real. */
const MESES_POR_ANIO = 12;

@Injectable()
export class PlatformDashboardService {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly planesService: PlanesService,
    private readonly facturasPlataformaService: FacturasPlataformaService,
  ) {}

  async resumen() {
    const [tenants, planes, facturasCartera] = await Promise.all([
      this.tenantsService.listar(),
      this.planesService.listar(),
      this.facturasPlataformaService.listarPendientesOVencidas(),
    ]);

    const activos = tenants.filter((t) => t.estado === 'ACTIVO');
    const suspendidos = tenants.filter((t) => t.estado === 'SUSPENDIDO');
    const cancelados = tenants.filter((t) => t.estado === 'CANCELADO');

    const mrrAproximado = activos.reduce((acc, t) => {
      if (!t.plan) return acc;
      const precio = Number(t.plan.precio);
      return acc + (t.plan.cicloFacturacion === 'ANUAL' ? precio / MESES_POR_ANIO : precio);
    }, 0);

    const cantidadPorPlan = new Map<string, number>();
    for (const t of tenants) {
      if (!t.planId) continue;
      cantidadPorPlan.set(t.planId, (cantidadPorPlan.get(t.planId) ?? 0) + 1);
    }
    const tenantsPorPlan = planes.map((p) => ({ planId: p.id, nombre: p.nombre, cantidadTenants: cantidadPorPlan.get(p.id) ?? 0 }));

    let totalPendiente = 0;
    let totalVencido = 0;
    let cantidadVencidas = 0;
    for (const f of facturasCartera) {
      const total = Number(f.total);
      if (f.estado === 'VENCIDA') {
        totalVencido += total;
        cantidadVencidas += 1;
      } else {
        totalPendiente += total;
      }
    }

    return {
      tenants: { total: tenants.length, activos: activos.length, suspendidos: suspendidos.length, cancelados: cancelados.length },
      mrrAproximado,
      tenantsPorPlan,
      cartera: { totalPendiente, totalVencido, cantidadVencidas },
    };
  }
}
