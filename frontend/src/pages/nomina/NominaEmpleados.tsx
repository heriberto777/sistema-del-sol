import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { EmpleadosTable } from '../../components/organisms/EmpleadosTable/EmpleadosTable';

export function NominaEmpleados() {
  return (
    <ModuloPestanas titulo="Empleados" descripcion="Catálogo de empleados activos en tu nómina." permiso="nomina.ver">
      <EmpleadosTable />
    </ModuloPestanas>
  );
}
