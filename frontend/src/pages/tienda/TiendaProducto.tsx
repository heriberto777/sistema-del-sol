import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTiendaConfig, useTiendaProducto } from '../../hooks/useTienda';
import { useCarritoTienda } from '../../hooks/useCarritoTienda';
import { PLANTILLAS } from './plantillas';
import { TiendaCargando, TiendaNoEncontrada } from './TiendaNoEncontrada';

export function TiendaProducto() {
  const { subdominio = '', productoId = '' } = useParams();
  const [varianteId, setVarianteId] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const carrito = useCarritoTienda(subdominio);

  const { data: config, isLoading: cargandoConfig, isError: errorConfig } = useTiendaConfig(subdominio);
  const { data: producto, isLoading: cargandoProducto, isError: errorProducto } = useTiendaProducto(subdominio, productoId);

  // Producto sin atributos reales (el caso normal) — una sola variante, se
  // auto-elige para no exigirle al comprador un clic de más.
  useEffect(() => {
    if (producto?.variantes.length === 1) setVarianteId(producto.variantes[0].id);
  }, [producto]);

  if (cargandoConfig || cargandoProducto) return <TiendaCargando />;
  if (errorConfig || errorProducto || !config || !producto) return <TiendaNoEncontrada />;

  const varianteSeleccionada = producto.variantes.find((v) => v.id === varianteId) ?? null;
  const Producto = PLANTILLAS[config.plantilla].Producto;

  return (
    <Producto
      config={config}
      subdominio={subdominio}
      carrito={carrito}
      producto={producto}
      varianteSeleccionada={varianteSeleccionada}
      onSeleccionarVariante={setVarianteId}
      cantidad={cantidad}
      onCantidadChange={setCantidad}
      onAgregar={() => {
        if (!varianteSeleccionada) return;
        carrito.agregar(
          {
            productoId: producto.id,
            varianteId: varianteSeleccionada.id,
            varianteEtiqueta: varianteSeleccionada.etiqueta,
            nombre: producto.nombre,
            precio: Number(varianteSeleccionada.precio ?? 0),
            imagen: producto.imagen,
          },
          cantidad,
        );
        setCantidad(1);
      }}
    />
  );
}
