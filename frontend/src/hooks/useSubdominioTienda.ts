import { useParams } from 'react-router-dom';

/**
 * Resuelve el subdominio del tenant tanto en desarrollo (URL con
 * `/tienda/:subdominio`, vía `useParams`) como en producción
 * (`<subdominio>.dominio.com`, sin `:subdominio` en la URL visible —
 * ver `router.tsx`, `resolverContextoTienda`, que monta el árbol de
 * rutas de la tienda directo en `/` cuando el hostname real tiene un
 * subdominio de tenant). `useParams` gana si está presente — en
 * desarrollo (`localhost:5555/tienda/demo`) siempre lo está.
 */
export function useSubdominioTienda(): string {
  const { subdominio } = useParams<{ subdominio?: string }>();
  return subdominio ?? window.location.hostname.split('.')[0];
}
