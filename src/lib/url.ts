/**
 * URL pública de la app, absoluta y sin barra final.
 *
 * El Open Graph la necesita sí o sí: los crawlers no resuelven URLs relativas, y si el
 * `og:image` sale relativo el preview aparece sin imagen (A2).
 */
export function baseUrl(): string {
  const explicita = process.env.NEXT_PUBLIC_BASE_URL;
  if (explicita) return explicita.replace(/\/+$/, "");

  // En Vercel se completa solo, sin tener que configurar nada al desplegar.
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

export function urlJuntada(slug: string): string {
  return `${baseUrl()}/j/${slug}`;
}
