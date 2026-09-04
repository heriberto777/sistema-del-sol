import { useContext } from 'react';
import { useParams } from 'react-router-dom';
import { SubdominioTiendaContext } from '../lib/resolver-subdominio-tienda';

/**
 * Resuelve el subdominio del tenant tanto en desarrollo (URL con
 * `/tienda/:subdominio`, vía `useParams`) como en producción — ahí no hay
 * `:subdominio` en la URL visible, así que se toma el que `App.tsx` ya
 * resolvió antes de montar el router (`SubdominioTiendaContext`): o bien
 * `<subdominio>.ciguadev.com` (recortado del hostname, síncrono) o bien un
 * dominio propio de tenant (resuelto vía API — acá NO se puede derivar
 * recortando el hostname, a diferencia del caso anterior). `useParams`
 * gana si está presente — en desarrollo siempre lo está.
 */
export function useSubdominioTienda(): string {
  const { subdominio } = useParams<{ subdominio?: string }>();
  const delContexto = useContext(SubdominioTiendaContext);
  return subdominio ?? delContexto ?? window.location.hostname.split('.')[0];
}
