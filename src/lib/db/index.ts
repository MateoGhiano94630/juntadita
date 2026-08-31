import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Falta DATABASE_URL. Copiá .env.example a .env y pegá la connection string de Neon.",
  );
}

/**
 * Driver HTTP de Neon: una request por query, sin pool de conexiones que se rompa
 * entre invocaciones serverless.
 *
 * ⚠ Este driver NO soporta `db.transaction()` (tira error). Para escribir varias tablas
 * de forma atómica se usa `db.batch([...])`, que Neon ejecuta como una sola transacción
 * en un solo viaje HTTP. Por eso los ids se generan en la app (`crypto.randomUUID()`):
 * un batch no puede leer el resultado de un statement para usarlo en el siguiente.
 */
export const db = drizzle(neon(process.env.DATABASE_URL), { schema });

export { schema };
