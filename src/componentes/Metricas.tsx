"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { redactarUrl } from "@/lib/metricas";

/**
 * Métricas de uso: cuánta gente entra y a qué pantallas.
 *
 * Vercel Web Analytics no usa cookies ni arma un perfil que siga a nadie entre sitios, así
 * que no hace falta banner de consentimiento. El script pesa ~1KB, carga asíncrono y no
 * bloquea el render; el beacon va al mismo origen (`/_vercel/insights/…`), o sea que la CSP
 * de `next.config.ts` lo deja pasar con el `'self'` que ya tiene, sin abrirle la mano a
 * ningún dominio externo.
 *
 * Lo único delicado es el slug de la juntada, que es el control de acceso y viaja en la URL
 * del pageview. `redactarUrl` lo enmascara antes de que salga; el porqué está explicado en
 * `lib/metricas.ts`, junto con los tests.
 */
export function Metricas() {
  // En desarrollo no se manda nada: el endpoint solo existe en Vercel y en local lo único
  // que haría es ensuciar la consola con 404. Mismo criterio que la CSP, que también va
  // solo en producción.
  if (process.env.NODE_ENV !== "production") return null;

  return (
    <Analytics
      beforeSend={(evento: BeforeSendEvent) => {
        const url = redactarUrl(evento.url);
        return url === null ? null : { ...evento, url };
      }}
    />
  );
}
