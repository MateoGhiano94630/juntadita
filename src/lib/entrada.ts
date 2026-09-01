/**
 * Chequeos de forma para lo que llega a las server actions.
 *
 * Las acciones son endpoints PÚBLICOS y reciben un objeto que arma el cliente. Nada garantiza
 * que `descripcion` sea un string ni que `juntadaId` sea un UUID: si llega otra cosa, `.trim()`
 * explota o Postgres rechaza el cast, y en los dos casos el resultado es un 500 sin control en
 * un endpoint que cualquiera puede llamar.
 *
 * Esto no es una capa de seguridad —Drizzle parametriza y el control de acceso es el slug
 * (R-5)— sino de robustez: que una entrada rara devuelva un error entendible en vez de reventar,
 * y que ninguna lista sin tope llegue a armar una consulta.
 *
 * Se hace a mano y no con una librería de schemas a propósito: son cinco formas y el proyecto
 * tiene seis dependencias. No hace falta una séptima para esto.
 *
 * Se usa con un import de namespace, que es lo que hace que se lea solo:
 *
 *     import * as leer from "./entrada";
 *     const juntadaId = leer.uuid(entrada, "juntadaId");
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Saca un campo de algo que puede no ser ni un objeto: una acción puede recibir cualquier cosa. */
function campo(entrada: unknown, nombre: string): unknown {
  return entrada !== null && typeof entrada === "object"
    ? (entrada as Record<string, unknown>)[nombre]
    : undefined;
}

export function uuid(entrada: unknown, nombre: string): string | null {
  const valor = campo(entrada, nombre);
  return typeof valor === "string" && UUID.test(valor) ? valor : null;
}

/**
 * Slug de juntada, con la forma exacta que produce `generarSlug`.
 *
 * Se valida porque termina dentro de `revalidatePath("/j/" + slug)` y de una consulta: no
 * queremos que un slug con barras o con basura llegue a ninguno de los dos.
 */
export function slug(entrada: unknown, nombre: string): string | null {
  const valor = campo(entrada, nombre);
  return typeof valor === "string" && valor.length <= 60 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(valor)
    ? valor
    : null;
}

/** Texto recortado y sin espacios al borde. `null` si no es texto o si quedó vacío. */
export function texto(entrada: unknown, nombre: string, largoMax: number): string | null {
  const valor = campo(entrada, nombre);
  if (typeof valor !== "string") return null;
  const limpio = valor.trim().slice(0, largoMax);
  return limpio === "" ? null : limpio;
}

/** Igual que `texto`, pero el vacío es un valor válido: es como se borra un alias. */
export function textoQuePuedeIrVacio(
  entrada: unknown,
  nombre: string,
  largoMax: number,
): string | null {
  const valor = campo(entrada, nombre);
  return typeof valor === "string" ? valor.trim().slice(0, largoMax) : null;
}

/** Centavos: entero seguro y positivo. Nunca un float, nunca cero (RN-12). */
export function centavos(entrada: unknown, nombre: string): number | null {
  const valor = campo(entrada, nombre);
  return typeof valor === "number" && Number.isSafeInteger(valor) && valor > 0 ? valor : null;
}

/** Bandera opcional: cualquier cosa que no sea `true` se lee como false. */
export function bandera(entrada: unknown, nombre: string): boolean {
  return campo(entrada, nombre) === true;
}

/**
 * Lista de ids, sin repetidos y acotada.
 *
 * El tope importa: sin él, mandar cincuenta mil ids arma un `IN (...)` de cincuenta mil
 * parámetros en un endpoint sin autenticación. Los repetidos se descartan acá para que el
 * reparto no dependa de que el cliente mande la lista limpia.
 */
export function listaDeIds(entrada: unknown, nombre: string, largoMax: number): string[] | null {
  const valor = campo(entrada, nombre);
  if (!Array.isArray(valor) || valor.length === 0 || valor.length > largoMax) return null;

  const ids: string[] = [];
  for (const item of valor) {
    if (typeof item !== "string" || !UUID.test(item)) return null;
    ids.push(item);
  }
  return [...new Set(ids)];
}
