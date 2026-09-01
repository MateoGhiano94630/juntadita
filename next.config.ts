import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad.
 *
 * La más importante acá no es la CSP sino `Referrer-Policy`: en esta app **la URL es el
 * secreto** (R-5, el slug es el único control de acceso). Sin política de referer, cualquier
 * link saliente que se agregue en el futuro filtraría la juntada entera en el header de la
 * request. `no-referrer` lo cierra de una y no cuesta nada: no hay nada acá que dependa del
 * referer.
 *
 * La CSP va solo en producción: en desarrollo, React Refresh usa `eval` y un websocket, así
 * que una CSP estricta rompería el hot reload. Lleva `'unsafe-inline'` en scripts porque Next
 * inyecta el payload de RSC inline y evitarlo pide nonces por request, o sea un middleware.
 * Igual sirve: lo que corta es cargar un script de otro dominio, que es cómo un XSS escala.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const cabeceras = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy", value: csp }]
    : []),
];

const nextConfig: NextConfig = {
  // Next 16 escribe AGENTS.md y CLAUDE.md en la raíz en cada `next dev`.
  // No son parte del alcance de este MVP, así que se apagan.
  agentRules: false,

  async headers() {
    return [{ source: "/:path*", headers: cabeceras }];
  },
};

export default nextConfig;
