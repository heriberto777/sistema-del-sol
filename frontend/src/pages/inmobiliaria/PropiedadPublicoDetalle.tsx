import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Heart, MessageCircle } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { ETIQUETA_TIPO_PROPIEDAD, PropiedadPublica } from '../../types/inmobiliaria';
import { ContextoInmobiliariaPublica } from './InmobiliariaPublicaLayout';
import { useFavoritosPropiedades } from './useFavoritosPropiedades';
import { CalculadoraHipoteca } from './CalculadoraHipoteca';

/** Mismo criterio simple que BotonWhatsAppProducto/PedidosTiendaPanel — sin librería de formato de teléfono en el repo. */
function telefonoWhatsapp(telefono: string) {
  const digitos = telefono.replace(/\D/g, '');
  return digitos.length === 10 ? `1${digitos}` : digitos;
}

export function PropiedadPublicoDetalle() {
  const { propiedadId = '' } = useParams();
  const { subdominio } = useOutletContext<ContextoInmobiliariaPublica>();
  const { esFavorito, alternar } = useFavoritosPropiedades(subdominio);

  const { data: propiedad, isLoading, isError } = useQuery({
    queryKey: ['inmobiliaria-publica-propiedad', subdominio, propiedadId],
    queryFn: async () => (await apiClient.get<PropiedadPublica>(`/inmobiliaria/${subdominio}/propiedades/${propiedadId}`)).data,
  });

  if (isLoading) return <p className="p-10 text-center text-sm text-slate-400">Cargando…</p>;
  if (isError || !propiedad) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16 text-center">
        <p className="text-lg font-semibold text-slate-700">Propiedad no encontrada</p>
        <Link to={`/inmobiliaria/${subdominio}`} className="mt-2 inline-block text-sm text-teal-700 hover:underline">
          ‹ Volver al catálogo
        </Link>
      </div>
    );
  }

  const simbolo = propiedad.moneda === 'DOP' ? 'RD$' : 'US$';
  const mensajeWhatsapp = `Hola! Me interesa *${propiedad.titulo}* (${simbolo} ${Number(propiedad.precio).toLocaleString('es-DO')}): ${window.location.href}`;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <Link to={`/inmobiliaria/${subdominio}`} className="text-sm text-teal-700 hover:underline">
        ‹ Volver al catálogo
      </Link>

      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
              {ETIQUETA_TIPO_PROPIEDAD[propiedad.tipo] ?? propiedad.tipo} · Cód. {propiedad.codigo}
            </p>
            <h1 className="text-2xl font-bold text-slate-900">{propiedad.titulo}</h1>
            <p className="text-sm text-slate-500">{propiedad.ubicacion}</p>
          </div>
          <button
            type="button"
            onClick={() => alternar(propiedad.id)}
            aria-label="Guardar en favoritos"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${esFavorito(propiedad.id) ? 'border-red-200 bg-red-50 text-red-500' : 'border-slate-200 text-slate-400 hover:text-red-500'}`}
          >
            <Heart size={18} fill={esFavorito(propiedad.id) ? 'currentColor' : 'none'} />
          </button>
        </div>

        {propiedad.imagenes.length > 0 && (
          <div className="mt-5 grid grid-cols-4 gap-2 sm:h-72">
            {propiedad.imagenes.slice(0, 5).map((img, i) => (
              <div
                key={img.id}
                className={`overflow-hidden rounded-xl bg-slate-100 ${i === 0 ? 'col-span-4 sm:col-span-2 sm:row-span-2' : 'col-span-2 sm:col-span-1'}`}
              >
                <img src={img.imagen} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="text-3xl font-bold text-slate-900">
              {simbolo} {Number(propiedad.precio).toLocaleString('es-DO')}
              {propiedad.operacion === 'ALQUILER' && <span className="text-base font-normal text-slate-400">/mes</span>}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {propiedad.habitaciones != null && (
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{propiedad.habitaciones}</p>
                  <p className="text-xs text-slate-500">Habitaciones</p>
                </div>
              )}
              {propiedad.banos != null && (
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{propiedad.banos}</p>
                  <p className="text-xs text-slate-500">Baños</p>
                </div>
              )}
              {propiedad.parqueos != null && (
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{propiedad.parqueos}</p>
                  <p className="text-xs text-slate-500">Parqueos</p>
                </div>
              )}
              {propiedad.metrosConstruccion != null && (
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{propiedad.metrosConstruccion} m²</p>
                  <p className="text-xs text-slate-500">Construcción</p>
                </div>
              )}
            </div>

            {propiedad.descripcion && (
              <>
                <h3 className="mt-6 font-semibold text-slate-900">Descripción</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{propiedad.descripcion}</p>
              </>
            )}

            {propiedad.amenidades.length > 0 && (
              <>
                <h3 className="mt-6 font-semibold text-slate-900">Amenidades</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
                  {propiedad.amenidades.map((a) => (
                    <span key={a} className="rounded-full bg-slate-50 px-3 py-1">
                      {a}
                    </span>
                  ))}
                </div>
              </>
            )}

            {propiedad.operacion === 'VENTA' && <CalculadoraHipoteca precio={Number(propiedad.precio)} simbolo={simbolo} />}
          </div>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-slate-50 p-5">
            {propiedad.agente ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-lg font-bold text-white">
                    {propiedad.agente.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{propiedad.agente.nombre}</p>
                    <p className="text-xs text-slate-500">Agente inmobiliario</p>
                  </div>
                </div>
                {propiedad.agente.telefono ? (
                  <a
                    href={`https://wa.me/${telefonoWhatsapp(propiedad.agente.telefono)}?text=${encodeURIComponent(mensajeWhatsapp)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                  >
                    <MessageCircle size={16} />
                    Escribir por WhatsApp
                  </a>
                ) : (
                  <p className="mt-4 text-xs text-slate-400">Este agente no tiene teléfono cargado.</p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">Consultanos por esta propiedad — todavía no tiene agente asignado.</p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
