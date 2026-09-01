import "server-only";
import { cache } from "react";
import { asc, count, eq, sum } from "drizzle-orm";
import { db } from "./db";
import { gastos, juntadas, pagos, participantes, repartos } from "./db/schema";
import { calcularSaldos, totalGastado } from "./dominio/saldos";
import { liquidacionMinima } from "./dominio/liquidacion";
import type { Gasto, Pago, Participante, Saldo, Transferencia } from "./dominio/tipos";

/**
 * El participante con lo que necesita la pantalla. Extiende el tipo del dominio en vez de
 * ensuciarlo: al motor de cálculo el alias no le importa, y sigue aceptando esto tal cual.
 */
export interface ParticipanteUI extends Participante {
  alias: string | null;
}

export interface JuntadaCompleta {
  id: string;
  slug: string;
  nombre: string;
  actualizadaEn: Date;
  participantes: ParticipanteUI[];
  gastos: Gasto[];
  pagos: Pago[];
  saldos: Saldo[];
  liquidacion: Transferencia[];
  totalCentavos: number;
}

/**
 * Trae la juntada entera y deriva saldos y liquidación con el motor puro.
 *
 * Se hace en el servidor y en cada request: los saldos NUNCA se guardan (RN-03 / A4).
 * Son cuatro queries por slug; para una juntada de asado eso es irrelevante y evita
 * armar un join que después hay que desarmar a mano.
 *
 * Va envuelta en `cache()` de React porque la página la pide dos veces por request —una en
 * `generateMetadata` para el preview y otra en el componente— y sin esto son diez viajes a
 * la base en vez de cinco. El cache dura lo que dura el request: no hay datos viejos.
 */
export const getJuntadaPorSlug = cache(async (slug: string): Promise<JuntadaCompleta | null> => {
  const [juntada] = await db.select().from(juntadas).where(eq(juntadas.slug, slug)).limit(1);
  if (!juntada) return null;

  const [filasParticipantes, filasGastos, filasPagos] = await Promise.all([
    db
      .select()
      .from(participantes)
      .where(eq(participantes.juntadaId, juntada.id))
      .orderBy(asc(participantes.orden)),
    db
      .select()
      .from(gastos)
      .where(eq(gastos.juntadaId, juntada.id))
      .orderBy(asc(gastos.creadoEn)),
    db.select().from(pagos).where(eq(pagos.juntadaId, juntada.id)).orderBy(asc(pagos.creadoEn)),
  ]);

  const filasRepartos = filasGastos.length
    ? await db
        .select()
        .from(repartos)
        .innerJoin(gastos, eq(repartos.gastoId, gastos.id))
        .where(eq(gastos.juntadaId, juntada.id))
    : [];

  const repartosPorGasto = new Map<string, { participanteId: string; montoCentavos: number }[]>();
  for (const fila of filasRepartos) {
    const lista = repartosPorGasto.get(fila.reparto.gastoId) ?? [];
    lista.push({
      participanteId: fila.reparto.participanteId,
      montoCentavos: fila.reparto.montoCentavos,
    });
    repartosPorGasto.set(fila.reparto.gastoId, lista);
  }

  const listaParticipantes: ParticipanteUI[] = filasParticipantes.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    orden: p.orden,
    alias: p.alias,
  }));

  const ordenPorId = new Map(listaParticipantes.map((p) => [p.id, p.orden]));
  const listaGastos: Gasto[] = filasGastos.map((g) => ({
    id: g.id,
    descripcion: g.descripcion,
    montoCentavos: g.montoCentavos,
    pagadorId: g.pagadorId,
    repartos: (repartosPorGasto.get(g.id) ?? []).sort(
      (a, b) =>
        (ordenPorId.get(a.participanteId) ?? 0) - (ordenPorId.get(b.participanteId) ?? 0),
    ),
  }));

  const listaPagos: Pago[] = filasPagos.map((p) => ({
    id: p.id,
    deId: p.deId,
    aId: p.aId,
    montoCentavos: p.montoCentavos,
  }));

  const saldos = calcularSaldos(listaParticipantes, listaGastos, listaPagos);

  return {
    id: juntada.id,
    slug: juntada.slug,
    nombre: juntada.nombre,
    actualizadaEn: juntada.actualizadaEn,
    participantes: listaParticipantes,
    gastos: listaGastos,
    pagos: listaPagos,
    saldos,
    liquidacion: liquidacionMinima(saldos),
    totalCentavos: totalGastado(listaGastos),
  };
});

/**
 * Solo lo que necesita la imagen del preview. Tiene que ser barato (RNF-04: <1s).
 *
 * No pasa por `getJuntadaPorSlug` a propósito: para mostrar un total y una cantidad de
 * personas, traer todos los gastos, todos los repartos y calcular saldos y liquidación es
 * trabajo tirado. Son tres consultas que la base resuelve con los índices que ya existen.
 *
 * La página NO usa esto: su `generateMetadata` deriva de la juntada completa, que el render
 * ya va a pedir igual, así que le sale gratis.
 */
export const getResumenParaPreview = cache(async (slug: string) => {
  const [juntada] = await db
    .select({
      id: juntadas.id,
      nombre: juntadas.nombre,
      actualizadaEn: juntadas.actualizadaEn,
    })
    .from(juntadas)
    .where(eq(juntadas.slug, slug))
    .limit(1);
  if (!juntada) return null;

  const [[personas], [total]] = await Promise.all([
    db
      .select({ cantidad: count() })
      .from(participantes)
      .where(eq(participantes.juntadaId, juntada.id)),
    db
      .select({ suma: sum(gastos.montoCentavos) })
      .from(gastos)
      .where(eq(gastos.juntadaId, juntada.id)),
  ]);

  return {
    nombre: juntada.nombre,
    // `sum` de un bigint vuelve como string, y como null si no hay ningún gasto.
    totalCentavos: Number(total?.suma ?? 0),
    cantidadPersonas: personas?.cantidad ?? 0,
    actualizadaEn: juntada.actualizadaEn,
  };
});
