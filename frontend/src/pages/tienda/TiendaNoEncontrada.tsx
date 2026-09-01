export function TiendaNoEncontrada() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 px-6 text-center dark:bg-slate-950">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Tienda no encontrada</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">Verificá el enlace — esta tienda no existe o no está disponible.</p>
    </div>
  );
}

export function TiendaCargando() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
    </div>
  );
}
