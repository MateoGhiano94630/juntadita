"use server";

import { and, count, eq, inArray, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "./db";
import { gastos, juntadas, pagos, participantes, repartos } from "./db/schema";
import { repartirIgual } from "./dominio/reparto";
import { generarSlug } from "./slug";

/**
 * Server actions. Todas son endpoints PÚBLICOS: no hay login y el único control de acceso
 * es conocer el slug (R-5, riesgo aceptado).
 *
 * Por eso toda acción valida que los ids que recibe pertenezcan a la juntada que dice.
 * Sin ese chequeo se podría meter un reparto apuntando a un participante de otra juntada:
 * la FK no lo detecta (el id existe) y rompería la invariante de saldos de las dos.
 */

export type Resultado = { ok: true } | { ok: false; error: string };

const MAX_PARTICIPANTES = 60;
const LARGO_NOMBRE = 80;
/** Un CVU son 22 dígitos y un alias llega a 20 caracteres. 50 sobra para los dos. */
const LARGO_ALIAS = 50;

const tocarJuntada = (juntadaId: string) =>
  db.update(juntadas).set({ actualizadaEn: new Date() }).where(eq(juntadas.id, juntadaId));

const refrescar = (slug: string) => revalidatePath(`/j/${slug}`);

/** Separa el textarea de participantes: uno por línea o separados por coma. */
function parsearParticipantes(texto: string): string[] {
  return texto
    .split(/[\n,]/)
    .map((n) => n.trim().slice(0, LARGO_NOMBRE))
    .filter((n) => n.length > 0);
}

/** Devuelve los participantes de la juntada, o null si alguno de los ids no es de acá. */
async function validarParticipantes(juntadaId: string, ids: string[]) {
  if (ids.length === 0) return null;
  const filas = await db
    .select()
    .from(participantes)
    .where(and(eq(participantes.juntadaId, juntadaId), inArray(participantes.id, ids)));
  const encontrados = new Set(filas.map((f) => f.id));
  if (ids.some((id) => !encontrados.has(id))) return null;
  return filas.map((f) => ({ id: f.id, nombre: f.nombre, orden: f.orden }));
}

// ---------------------------------------------------------------------------
// Crear
// ---------------------------------------------------------------------------

export type EstadoCrear = { error?: string };

export async function crearJuntada(
  _previo: EstadoCrear,
  formData: FormData,
): Promise<EstadoCrear> {
  const nombre = String(formData.get("nombre") ?? "").trim().slice(0, LARGO_NOMBRE);
  const nombres = parsearParticipantes(String(formData.get("participantes") ?? ""));

  if (!nombre) return { error: "Ponele un nombre a la juntada." };
  if (nombres.length === 0) return { error: "Cargá al menos un participante." };
  if (nombres.length > MAX_PARTICIPANTES) {
    return { error: `Son demasiados. El máximo es ${MAX_PARTICIPANTES}.` };
  }

  // Colisión de slug: con 32^8 es casi imposible, pero es barato descartarla.
  let slug = generarSlug(nombre);
  for (let intento = 0; intento < 5; intento++) {
    const [existe] = await db
      .select({ id: juntadas.id })
      .from(juntadas)
      .where(eq(juntadas.slug, slug))
      .limit(1);
    if (!existe) break;
    slug = generarSlug(nombre);
  }

  const juntadaId = crypto.randomUUID();
  await db.batch([
    db.insert(juntadas).values({ id: juntadaId, slug, nombre }),
    db.insert(participantes).values(
      nombres.map((n, i) => ({
        id: crypto.randomUUID(),
        juntadaId,
        nombre: n,
        orden: i,
      })),
    ),
  ]);

  redirect(`/j/${slug}`);
}

// ---------------------------------------------------------------------------
// Gastos
// ---------------------------------------------------------------------------

export async function agregarGasto(entrada: {
  juntadaId: string;
  slug: string;
  descripcion: string;
  montoCentavos: number;
  pagadorId: string;
  participanteIds: string[];
}): Promise<Resultado> {
  const descripcion = entrada.descripcion.trim().slice(0, LARGO_NOMBRE);
  if (!descripcion) return { ok: false, error: "Falta la descripción." };
  if (!Number.isSafeInteger(entrada.montoCentavos) || entrada.montoCentavos <= 0) {
    return { ok: false, error: "El monto tiene que ser mayor a cero." };
  }

  const incluidos = await validarParticipantes(entrada.juntadaId, entrada.participanteIds);
  if (!incluidos) return { ok: false, error: "Elegí al menos una persona que participe." };

  const pagador = await validarParticipantes(entrada.juntadaId, [entrada.pagadorId]);
  if (!pagador) return { ok: false, error: "El que pagó no es de esta juntada." };

  const gastoId = crypto.randomUUID();
  const partes = repartirIgual(entrada.montoCentavos, incluidos, entrada.pagadorId);

  await db.batch([
    db.insert(gastos).values({
      id: gastoId,
      juntadaId: entrada.juntadaId,
      descripcion,
      montoCentavos: entrada.montoCentavos,
      pagadorId: entrada.pagadorId,
    }),
    db.insert(repartos).values(
      partes.map((p) => ({
        gastoId,
        participanteId: p.participanteId,
        montoCentavos: p.montoCentavos,
      })),
    ),
    tocarJuntada(entrada.juntadaId),
  ]);

  refrescar(entrada.slug);
  return { ok: true };
}

export async function editarGasto(entrada: {
  juntadaId: string;
  slug: string;
  gastoId: string;
  descripcion: string;
  montoCentavos: number;
  pagadorId: string;
  participanteIds: string[];
}): Promise<Resultado> {
  const descripcion = entrada.descripcion.trim().slice(0, LARGO_NOMBRE);
  if (!descripcion) return { ok: false, error: "Falta la descripción." };
  if (!Number.isSafeInteger(entrada.montoCentavos) || entrada.montoCentavos <= 0) {
    return { ok: false, error: "El monto tiene que ser mayor a cero." };
  }

  const [gasto] = await db
    .select({ id: gastos.id })
    .from(gastos)
    .where(and(eq(gastos.id, entrada.gastoId), eq(gastos.juntadaId, entrada.juntadaId)))
    .limit(1);
  if (!gasto) return { ok: false, error: "Ese gasto no existe." };

  const incluidos = await validarParticipantes(entrada.juntadaId, entrada.participanteIds);
  if (!incluidos) return { ok: false, error: "Elegí al menos una persona que participe." };

  const pagador = await validarParticipantes(entrada.juntadaId, [entrada.pagadorId]);
  if (!pagador) return { ok: false, error: "El que pagó no es de esta juntada." };

  const partes = repartirIgual(entrada.montoCentavos, incluidos, entrada.pagadorId);

  // El reparto se rehace entero: borrar e insertar es más simple que diffear, y al ir
  // dentro del mismo batch nadie ve el estado intermedio sin repartos.
  await db.batch([
    db.delete(repartos).where(eq(repartos.gastoId, entrada.gastoId)),
    db
      .update(gastos)
      .set({
        descripcion,
        montoCentavos: entrada.montoCentavos,
        pagadorId: entrada.pagadorId,
        actualizadoEn: new Date(),
      })
      .where(eq(gastos.id, entrada.gastoId)),
    db.insert(repartos).values(
      partes.map((p) => ({
        gastoId: entrada.gastoId,
        participanteId: p.participanteId,
        montoCentavos: p.montoCentavos,
      })),
    ),
    tocarJuntada(entrada.juntadaId),
  ]);

  refrescar(entrada.slug);
  return { ok: true };
}

export async function borrarGasto(entrada: {
  juntadaId: string;
  slug: string;
  gastoId: string;
}): Promise<Resultado> {
  // Los repartos se van solos por el ON DELETE CASCADE.
  await db.batch([
    db
      .delete(gastos)
      .where(and(eq(gastos.id, entrada.gastoId), eq(gastos.juntadaId, entrada.juntadaId))),
    tocarJuntada(entrada.juntadaId),
  ]);

  refrescar(entrada.slug);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Participantes
// ---------------------------------------------------------------------------

export async function agregarParticipante(entrada: {
  juntadaId: string;
  slug: string;
  nombre: string;
}): Promise<Resultado> {
  const nombre = entrada.nombre.trim().slice(0, LARGO_NOMBRE);
  if (!nombre) return { ok: false, error: "Falta el nombre." };

  const [resumen] = await db
    .select({ cantidad: count(), ultimoOrden: max(participantes.orden) })
    .from(participantes)
    .where(eq(participantes.juntadaId, entrada.juntadaId));

  if ((resumen?.cantidad ?? 0) >= MAX_PARTICIPANTES) {
    return { ok: false, error: `Ya son ${MAX_PARTICIPANTES}, que es el máximo.` };
  }

  // El que se suma va al final del orden, y ahí se queda para siempre. Los gastos que ya
  // estaban NO se recalculan: quien no estaba cuando se compró la carne, no la paga.
  await db.batch([
    db.insert(participantes).values({
      id: crypto.randomUUID(),
      juntadaId: entrada.juntadaId,
      nombre,
      orden: (resumen?.ultimoOrden ?? -1) + 1,
    }),
    tocarJuntada(entrada.juntadaId),
  ]);

  refrescar(entrada.slug);
  return { ok: true };
}

/**
 * Guarda el alias/CVU con el que a alguien le pueden transferir (RF-81).
 *
 * Mandar string vacío lo borra. No se valida contra ningún banco a propósito: es un dato
 * declarado, la plata nunca pasa por acá (RN-11) y un alias mal escrito lo arregla la
 * misma persona en dos toques.
 */
export async function guardarAlias(entrada: {
  juntadaId: string;
  slug: string;
  participanteId: string;
  alias: string;
}): Promise<Resultado> {
  const alias = entrada.alias.trim().slice(0, LARGO_ALIAS);

  const valido = await validarParticipantes(entrada.juntadaId, [entrada.participanteId]);
  if (!valido) return { ok: false, error: "Esa persona no es de esta juntada." };

  await db.batch([
    db
      .update(participantes)
      .set({ alias: alias || null })
      .where(eq(participantes.id, entrada.participanteId)),
    tocarJuntada(entrada.juntadaId),
  ]);

  refrescar(entrada.slug);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------------

export async function marcarSaldado(entrada: {
  juntadaId: string;
  slug: string;
  deId: string;
  aId: string;
  montoCentavos: number;
}): Promise<Resultado> {
  if (!Number.isSafeInteger(entrada.montoCentavos) || entrada.montoCentavos <= 0) {
    return { ok: false, error: "Monto inválido." };
  }
  if (entrada.deId === entrada.aId) {
    return { ok: false, error: "No podés pagarte a vos mismo." };
  }

  const validos = await validarParticipantes(entrada.juntadaId, [entrada.deId, entrada.aId]);
  if (!validos || validos.length !== 2) {
    return { ok: false, error: "Esas personas no son de esta juntada." };
  }

  await db.batch([
    db.insert(pagos).values({
      id: crypto.randomUUID(),
      juntadaId: entrada.juntadaId,
      deId: entrada.deId,
      aId: entrada.aId,
      montoCentavos: entrada.montoCentavos,
    }),
    tocarJuntada(entrada.juntadaId),
  ]);

  refrescar(entrada.slug);
  return { ok: true };
}

export async function borrarPago(entrada: {
  juntadaId: string;
  slug: string;
  pagoId: string;
}): Promise<Resultado> {
  await db.batch([
    db
      .delete(pagos)
      .where(and(eq(pagos.id, entrada.pagoId), eq(pagos.juntadaId, entrada.juntadaId))),
    tocarJuntada(entrada.juntadaId),
  ]);

  refrescar(entrada.slug);
  return { ok: true };
}
