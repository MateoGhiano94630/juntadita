/**
 * Copia texto al portapapeles. Devuelve `false` si el navegador no dejó.
 *
 * `navigator.clipboard` solo existe en contexto seguro (https o localhost). Probar la app
 * con un túnel http o entrando por la IP de la red local es justo el caso donde no está,
 * así que el que llama tiene que tener un plan B para mostrar el texto.
 */
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/**
 * Comparte con el selector nativo del sistema (RF-92). Devuelve `false` si no existe o si
 * la persona canceló, para que el que llama caiga al copiado.
 *
 * Va solo `text` y no `url`: el mensaje ya tiene el link adentro, y varias apps que reciben
 * los dos campos mandan únicamente la url y se comen el resumen, que es lo que tiene que
 * poder leerse sin abrir nada (P2).
 */
export async function compartirNativo(texto: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  try {
    await navigator.share({ text: texto });
    return true;
  } catch {
    // Incluye el AbortError de cuando cierran el selector: no es un error que mostrar.
    return false;
  }
}

export const hayCompartirNativo = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";
