import "server-only";
import { headers } from "next/headers";

/**
 * Límite de tasa en memoria, por proceso.
 *
 * Es best-effort A PROPÓSITO, y conviene ser honesto sobre qué frena y qué no. En serverless
 * cada instancia tiene su propio Map, así que esto NO defiende contra un ataque distribuido
 * ni contra alguien que rote IPs. Lo que sí frena es lo que realmente pasa cuando algo se
 * comparte: un script suelto o un bucle mal hecho martillando desde una IP.
 *
 * La alternativa seria es Redis o el rate limiting del proveedor, y las dos son una
 * dependencia y un costo fijo que este MVP no justifica todavía (RNF-41: costo por usuario
 * activo cercano a cero). Cuando haya tráfico real, esto se reemplaza sin tocar los llamadores.
 */

const ventanas = new Map<string, number[]>();

/** Tope de claves vivas. Sin esto, el Map crece con cada IP nueva hasta llenar la memoria. */
const MAX_CLAVES = 5_000;

/**
 * Registra un intento y dice si está dentro del límite.
 *
 * Devuelve `false` cuando ya se pasó: en ese caso NO cuenta el intento, así que insistir no
 * extiende el castigo. La ventana es deslizante, no de reloj fijo.
 */
export function dentroDelLimite(clave: string, maximo: number, ventanaMs: number): boolean {
  const ahora = Date.now();
  const desde = ahora - ventanaMs;

  // Poda perezosa: solo cuando el mapa creció de más, y en una sola pasada.
  if (ventanas.size > MAX_CLAVES) {
    for (const [k, marcas] of ventanas) {
      const vivas = marcas.filter((t) => t > desde);
      if (vivas.length === 0) ventanas.delete(k);
      else ventanas.set(k, vivas);
    }
  }

  const marcas = (ventanas.get(clave) ?? []).filter((t) => t > desde);

  if (marcas.length >= maximo) {
    ventanas.set(clave, marcas);
    return false;
  }

  marcas.push(ahora);
  ventanas.set(clave, marcas);
  return true;
}

/**
 * La IP del que llama, tal como la reporta el proxy.
 *
 * Es falsificable si la app queda expuesta sin un proxy adelante que reescriba el header.
 * Detrás de Vercel no lo es, y ese es el despliegue previsto.
 */
export async function ipDelCliente(): Promise<string> {
  const h = await headers();
  const reenviada = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return reenviada || h.get("x-real-ip") || "desconocida";
}
