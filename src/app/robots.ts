import type { MetadataRoute } from "next";
import { baseUrl } from "@/lib/url";

/**
 * Las juntadas no se indexan, pero los crawlers de preview sí tienen que entrar.
 *
 * El slug es el único control de acceso (R-5), así que no queremos que Google liste
 * juntadas ajenas. Pero bloquear a todo el mundo mataría el unfurl de WhatsApp, que es
 * justamente la hipótesis que estamos probando. De ahí las reglas por user-agent:
 * los crawlers de Meta entran, el resto no.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "facebookexternalhit", allow: "/" },
      { userAgent: "WhatsApp", allow: "/" },
      { userAgent: "Twitterbot", allow: "/" },
      { userAgent: "*", disallow: "/j/" },
    ],
    host: baseUrl(),
  };
}
