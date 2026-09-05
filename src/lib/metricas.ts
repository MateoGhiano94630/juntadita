/**
 * Redacción de la URL antes de que salga hacia las métricas.
 *
 * En esta app **la URL es el secreto**: el slug de la juntada es el único control de acceso
 * que existe (R-5), y es justamente lo que un evento de pageview manda por defecto. Dejarlo
 * salir significaría publicar la credencial de cada juntada en un panel de terceros, que es
 * exactamente lo que ya evita el `Referrer-Policy: no-referrer` de `next.config.ts`.
 *
 * Vive acá y no adentro del componente para que se pueda probar sin React: es una función de
 * string a string, y es la única pieza de las métricas donde un error tiene consecuencias.
 */

/**
 * Devuelve la URL lista para reportar, o `null` si no se pudo redactar con certeza.
 *
 * Falla cerrado a propósito: ante cualquier duda descarta el evento en vez de mandarlo sin
 * redactar. Perder una visita del contador no cuesta nada; filtrar un slug, sí.
 *
 *   https://arreglamo.app/j/asado-del-sabado-k7m2xq4p  →  https://arreglamo.app/j/[slug]
 */
export function redactarUrl(crudo: string): string | null {
  let url: URL;
  try {
    url = new URL(crudo);
  } catch {
    return null;
  }

  // Solo se reporta http(s). Cualquier otro esquema no es una navegación de la app.
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  // Hoy no hay nada sensible en query ni en hash. Se limpian igual para que siga siendo
  // cierto si mañana alguien agrega un parámetro sin acordarse de este archivo.
  url.search = "";
  url.hash = "";
  url.username = "";
  url.password = "";

  // Las dos rutas que llevan el slug adentro pierden el slug, junto con lo que cuelgue
  // abajo. El resto no tiene nada que ocultar: son la home y los estáticos.
  //
  // `/api/og/` no la navega una persona —la pide el crawler de WhatsApp— pero se enmascara
  // igual: cuesta una línea y evita tener que razonar sobre si algún día puede llegar acá.
  url.pathname = url.pathname
    .replace(/^\/j\/[^/]+/, "/j/[slug]")
    .replace(/^\/api\/og\/[^/]+/, "/api/og/[slug]");

  // Cinturón y tiradores: si después de reemplazar todavía queda algo que se parece a una
  // juntada sin enmascarar, no se manda nada.
  for (const [prefijo, enmascarado] of [
    ["/j/", "/j/[slug]"],
    ["/api/og/", "/api/og/[slug]"],
  ]) {
    if (url.pathname.startsWith(prefijo) && !url.pathname.startsWith(enmascarado)) return null;
  }

  return url.toString();
}
