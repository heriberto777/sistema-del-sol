import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSubdominioTienda } from '../../hooks/useSubdominioTienda';
import { useTiendaConfig, useTiendaProducto } from '../../hooks/useTienda';
import { useCarritoTiendaContext } from './CarritoTiendaContext';
import { precioOriginalParaCarrito, precioParaCarrito } from './OfertaEnTarjeta';
import { PLANTILLAS } from './plantillas';
import { TiendaCargando, TiendaNoEncontrada } from './TiendaNoEncontrada';

export function TiendaProducto() {
  const subdominio = useSubdominioTienda();
  const { productoId = '' } = useParams();
  const [varianteId, setVarianteId] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const carrito = useCarritoTiendaContext();

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
        // Bug real: el botón de cada plantilla ya se deshabilita sin
        // stock, pero esto es la fuente de verdad compartida por las 17
        // — sin este guard, un producto de una sola variante agotada
        // (sin selector visible, se auto-elige en el useEffect de
        // arriba) igual se podía agregar al carrito.
        if (!varianteSeleccionada || (varianteSeleccionada.stock !== null && varianteSeleccionada.stock <= 0)) return;
        carrito.agregar(
          {
            productoId: producto.id,
            varianteId: varianteSeleccionada.id,
            varianteEtiqueta: varianteSeleccionada.etiqueta,
            nombre: producto.nombre,
            precio: precioParaCarrito(varianteSeleccionada.precio, varianteSeleccionada.oferta),
            precioOriginal: precioOriginalParaCarrito(varianteSeleccionada.precio, varianteSeleccionada.oferta),
            imagen: producto.imagen,
          },
          cantidad,
        );
        setCantidad(1);
      }}
    />
  );
}
