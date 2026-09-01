import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTiendaConfig, useTiendaProducto } from '../../hooks/useTienda';
import { useCarritoTienda } from '../../hooks/useCarritoTienda';
import { PLANTILLAS } from './plantillas';
import { TiendaCargando, TiendaNoEncontrada } from './TiendaNoEncontrada';

export function TiendaProducto() {
  const { subdominio = '', productoId = '' } = useParams();
  const [cantidad, setCantidad] = useState(1);
  const carrito = useCarritoTienda(subdominio);

  const { data: config, isLoading: cargandoConfig, isError: errorConfig } = useTiendaConfig(subdominio);
  const { data: producto, isLoading: cargandoProducto, isError: errorProducto } = useTiendaProducto(subdominio, productoId);

  if (cargandoConfig || cargandoProducto) return <TiendaCargando />;
  if (errorConfig || errorProducto || !config || !producto) return <TiendaNoEncontrada />;

  const Producto = PLANTILLAS[config.plantilla].Producto;
  return (
    <Producto
      config={config}
      subdominio={subdominio}
      carrito={carrito}
      producto={producto}
      cantidad={cantidad}
      onCantidadChange={setCantidad}
      onAgregar={() => {
        carrito.agregar({ productoId: producto.id, nombre: producto.nombre, precio: Number(producto.precio ?? 0), imagen: producto.imagen }, cantidad);
        setCantidad(1);
      }}
    />
  );
}
