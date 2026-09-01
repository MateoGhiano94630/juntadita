import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Cinco tablas. Los montos son `bigint` de centavos (RN-12): `integer` se queda corto
 * en ~$21 millones y con la inflación local eso no es un techo cómodo.
 * `mode: "number"` los devuelve como number, seguro hasta 2^53 centavos.
 */

export const juntadas = pgTable("juntada", {
  id: uuid("id").primaryKey(),
  /** Legible + sufijo aleatorio. Es el único control de acceso que existe (RNF-30). */
  slug: text("slug").notNull().unique(),
  nombre: text("nombre").notNull(),
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
  /**
   * Se toca en TODA mutación de la juntada. Es el cache-buster del preview de WhatsApp:
   * la URL de la imagen de Open Graph lleva este valor, así que cuando el estado cambia,
   * la imagen es una URL nueva y el crawler no sirve la vieja.
   */
  actualizadaEn: timestamp("actualizada_en", { withTimezone: true }).notNull().defaultNow(),
});

export const participantes = pgTable(
  "participante",
  {
    id: uuid("id").primaryKey(),
    juntadaId: uuid("juntada_id")
      .notNull()
      .references(() => juntadas.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    /**
     * Alias o CVU para que le transfieran (RF-81). Declarado voluntariamente y nada más:
     * no se valida contra ningún banco y no se guarda ningún otro dato bancario (RNF-33).
     * La plata nunca pasa por acá (RN-11).
     */
    alias: text("alias"),
    /** Orden estable de incorporación. Define el reparto del residuo (RN-02) y nunca cambia. */
    orden: integer("orden").notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("participante_juntada_idx").on(t.juntadaId)],
);

export const gastos = pgTable(
  "gasto",
  {
    id: uuid("id").primaryKey(),
    juntadaId: uuid("juntada_id")
      .notNull()
      .references(() => juntadas.id, { onDelete: "cascade" }),
    descripcion: text("descripcion").notNull(),
    montoCentavos: bigint("monto_centavos", { mode: "number" }).notNull(),
    pagadorId: uuid("pagador_id")
      .notNull()
      .references(() => participantes.id, { onDelete: "restrict" }),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("gasto_juntada_idx").on(t.juntadaId)],
);

/**
 * El reparto guarda el monto ABSOLUTO que le toca a cada uno, no "quiénes participan".
 * Es lo que hace que sumar a alguien más tarde no recalcule los gastos viejos (RN-01).
 */
export const repartos = pgTable(
  "reparto",
  {
    gastoId: uuid("gasto_id")
      .notNull()
      .references(() => gastos.id, { onDelete: "cascade" }),
    participanteId: uuid("participante_id")
      .notNull()
      .references(() => participantes.id, { onDelete: "restrict" }),
    montoCentavos: bigint("monto_centavos", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.gastoId, t.participanteId] })],
);

/** Una transferencia que ya ocurrió por fuera. Nunca custodiamos plata (RN-11). */
export const pagos = pgTable(
  "pago",
  {
    id: uuid("id").primaryKey(),
    juntadaId: uuid("juntada_id")
      .notNull()
      .references(() => juntadas.id, { onDelete: "cascade" }),
    /** Quién puso la plata. */
    deId: uuid("de_id")
      .notNull()
      .references(() => participantes.id, { onDelete: "restrict" }),
    /** Quién la recibió. */
    aId: uuid("a_id")
      .notNull()
      .references(() => participantes.id, { onDelete: "restrict" }),
    montoCentavos: bigint("monto_centavos", { mode: "number" }).notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pago_juntada_idx").on(t.juntadaId)],
);
