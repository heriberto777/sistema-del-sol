import { ReactNode } from 'react';

interface AuthSplitLayoutProps {
  /** Fondo del panel visual — degradé de marca (CSS `background`, ej. `linear-gradient(...)`). */
  gradiente: string;
  /** Foto real opcional (ej. banner de la tienda) — se muestra debajo del degradé como overlay semitransparente. */
  imagenFondo?: string | null;
  /** Fila de marca (ícono/logo + nombre) arriba del panel visual. */
  marca: ReactNode;
  titulo: string;
  caracteristicas?: string[];
  /** Ej. el ThemeToggle — se posiciona flotante arriba a la derecha. */
  toolbar?: ReactNode;
  children: ReactNode;
}

/**
 * Layout "split lateral" compartido por los 3 logins (Plataforma, App, Cliente) —
 * panel visual de marca a la izquierda (oculto en mobile), formulario a la derecha.
 */
export function AuthSplitLayout({ gradiente, imagenFondo, marca, titulo, caracteristicas, toolbar, children }: AuthSplitLayoutProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      {toolbar && <div className="absolute right-4 top-4 z-20">{toolbar}</div>}

      <div className="flex w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-900/5 dark:bg-slate-900 dark:shadow-black/30 md:max-w-4xl md:border md:border-slate-200 md:dark:border-slate-800">
        <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden p-10 text-white md:flex" style={{ background: gradiente }}>
          {imagenFondo && (
            <>
              <img src={imagenFondo} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0" style={{ background: gradiente, opacity: 0.78 }} />
            </>
          )}
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, rgba(255,255,255,.25), transparent 45%), radial-gradient(circle at 80% 85%, rgba(255,255,255,.18), transparent 40%)',
            }}
          />
          <div className="relative z-10">{marca}</div>
          <div className="relative z-10">
            <h2 className="mb-3 max-w-[22ch] text-balance text-2xl font-bold leading-snug">{titulo}</h2>
            {caracteristicas && caracteristicas.length > 0 && (
              <ul className="mt-2 flex flex-col gap-2.5 text-sm">
                {caracteristicas.map((item) => (
                  <li key={item} className="flex items-center gap-2 opacity-95">
                    <span className="text-base font-extrabold leading-none">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col justify-center p-6 sm:p-8 md:w-[56%] md:p-12">{children}</div>
      </div>
    </div>
  );
}
