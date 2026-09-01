"use server";

import { and, count, eq, gte, inArray, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getJuntadaPorSlug } from "./consultas";
import { db } from "./db";
import * as leer from "./entrada";
import { dentroDelLimite, ipDelCliente } from "./limite";
import { gastos, juntadas, pagos, participantes, repartos } from "./db/schema";
import { repartirIgual } from "./dominio/reparto";
import { formatearPesos } from "./dinero";
import { generarSlug } from "./slug";

/**
 * Server actions. Todas son endpoints PÚBLICOS: no hay login y el único control de acceso
 * es conocer el slug (R-5, riesgo aceptado).
 *
 * Por eso toda acción valida que los ids que recibe pertenezcan a la juntada que dice.
 * Sin ese chequeo se podría meter un reparto apuntando a un participante de otra juntada:
 * la FK no lo detecta (el id existe) y rompería la invariante de saldos de las dos.
 */

/**
 * `confirmable` marca un rechazo que el que llama puede pasar por arriba: no es que la
 * operación esté mal, es que probablemente no sea la que se quiso hacer. La decisión de
 * insistir es de la persona, no nuestra.
 */
export type Resultado = { ok: true } | { ok: false; error: string; confirmable?: boolean };

/** Lo que se muestra cuando la entrada no tiene la forma esperada. No filtra nada de adentro. */
const ERROR_DE_FORMA = "Algo llegó mal. Recargá la página y probá de nuevo.";

const MAX_PARTICIPANTES = 60;
const LARGO_NOMBRE = 80;
/** Un CVU son 22 dígitos y un alias llega a 20 caracteres. 50 sobra para los dos. */
const LARGO_ALIAS = 50;

/**
 * Ventana para considerar que un pago es el mismo que otro ya registrado (ver `marcarSaldado`).
 *
 * Una hora alcanza: para tocar "Saldado" de más hace falta una pantalla vieja, y una pantalla
 * vieja no sobrevive a recargar la página. El caso real es el de dos personas mirando el
 * celular con minutos de diferencia, no el del día siguiente.
 */
const VENTANA_PAGO_DUPLICADO_MS = 60 * 60 * 1000;

/**
 * Cuántas juntadas puede crear una misma IP por hora.
 *
 * Crear es la única acción que no necesita conocer ningún slug, así que es la única que se
 * puede llamar sin haber recibido un link: sin tope, un script llena la base gratis. Diez
 * por hora deja tranquilo a un grupo que está probando y corta un bucle.
 */
const MAX_JUNTADAS_POR_HORA = 10;

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
  // Un FormData puede traer File además de string, así que se descarta lo que no sea texto.
  const crudo = (clave: string) => {
    const valor = formData.get(clave);
    return typeof valor === "string" ? valor : "";
  };

  const nombre = crudo("nombre").trim().slice(0, LARGO_NOMBRE);
  const nombres = parsearParticipantes(crudo("participantes"));

  if (!nombre) return { error: "Ponele un nombre a la juntada." };
  if (nombres.length === 0) return { error: "Cargá al menos un participante." };
  if (nombres.length > MAX_PARTICIPANTES) {
    return { error: `Son demasiados. El máximo es ${MAX_PARTICIPANTES}.` };
  }

  // Se chequea después de validar el formulario: que un error de tipeo no gaste intentos.
  const ip = await ipDelCliente();
  if (!dentroDelLimite(`crear:${ip}`, MAX_JUNTADAS_POR_HORA, 60 * 60 * 1000)) {
    return { error: "Creaste muchas juntadas seguidas. Esperá un rato y probá de nuevo." };
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
  const juntadaId = leer.uuid(entrada, "juntadaId");
  const slug = leer.slug(entrada, "slug");
  const pagadorId = leer.uuid(entrada, "pagadorId");
  const participanteIds = leer.listaDeIds(entrada, "participanteIds", MAX_PARTICIPANTES);
  if (!juntadaId || !slug || !pagadorId || !participanteIds) {
    return { ok: false, error: ERROR_DE_FORMA };
  }

  const descripcion = leer.texto(entrada, "descripcion", LARGO_NOMBRE);
  if (!descripcion) return { ok: false, error: "Falta la descripción." };

  const montoCentavos = leer.centavos(entrada, "montoCentavos");
  if (!montoCentavos) return { ok: false, error: "El monto tiene que ser mayor a cero." };

  const incluidos = await validarParticipantes(juntadaId, participanteIds);
  if (!incluidos) return { ok: false, error: "Elegí al menos una persona que participe." };

  const pagador = await validarParticipantes(juntadaId, [pagadorId]);
  if (!pagador) return { ok: false, error: "El que pagó no es de esta juntada." };

  const gastoId = crypto.randomUUID();
  const partes = repartirIgual(montoCentavos, incluidos, pagadorId);

  await db.batch([
    db.insert(gastos).values({
      id: gastoId,
      juntadaId,
      descripcion,
      montoCentavos,
      pagadorId,
    }),
    db.insert(repartos).values(
      partes.map((p) => ({
        gastoId,
        participanteId: p.participanteId,
        montoCentavos: p.montoCentavos,
      })),
    ),
    tocarJuntada(juntadaId),
  ]);

  refrescar(slug);
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
  const juntadaId = leer.uuid(entrada, "juntadaId");
  const slug = leer.slug(entrada, "slug");
  const gastoId = leer.uuid(entrada, "gastoId");
  const pagadorId = leer.uuid(entrada, "pagadorId");
  const participanteIds = leer.listaDeIds(entrada, "participanteIds", MAX_PARTICIPANTES);
  if (!juntadaId || !slug || !gastoId || !pagadorId || !participanteIds) {
    return { ok: false, error: ERROR_DE_FORMA };
  }

  const descripcion = leer.texto(entrada, "descripcion", LARGO_NOMBRE);
  if (!descripcion) return { ok: false, error: "Falta la descripción." };

  const montoCentavos = leer.centavos(entrada, "montoCentavos");
  if (!montoCentavos) return { ok: false, error: "El monto tiene que ser mayor a cero." };

  const [gasto] = await db
    .select({ id: gastos.id })
    .from(gastos)
    .where(and(eq(gastos.id, gastoId), eq(gastos.juntadaId, juntadaId)))
    .limit(1);
  if (!gasto) return { ok: false, error: "Ese gasto no existe." };

  const incluidos = await validarParticipantes(juntadaId, participanteIds);
  if (!incluidos) return { ok: false, error: "Elegí al menos una persona que participe." };

  const pagador = await validarParticipantes(juntadaId, [pagadorId]);
  if (!pagador) return { ok: false, error: "El que pagó no es de esta juntada." };

  const partes = repartirIgual(montoCentavos, incluidos, pagadorId);

  // El reparto se rehace entero: borrar e insertar es más simple que diffear, y al ir
  // dentro del mismo batch nadie ve el estado intermedio sin repartos.
  await db.batch([
    db.delete(repartos).where(eq(repartos.gastoId, gastoId)),
    db
      .update(gastos)
      .set({
        descripcion,
        montoCentavos,
        pagadorId,
        actualizadoEn: new Date(),
      })
      .where(eq(gastos.id, gastoId)),
    db.insert(repartos).values(
      partes.map((p) => ({
        gastoId,
        participanteId: p.participanteId,
        montoCentavos: p.montoCentavos,
      })),
    ),
    tocarJuntada(juntadaId),
  ]);

  refrescar(slug);
  return { ok: true };
}

export async function borrarGasto(entrada: {
  juntadaId: string;
  slug: string;
  gastoId: string;
}): Promise<Resultado> {
  const juntadaId = leer.uuid(entrada, "juntadaId");
  const slug = leer.slug(entrada, "slug");
  const gastoId = leer.uuid(entrada, "gastoId");
  if (!juntadaId || !slug || !gastoId) return { ok: false, error: ERROR_DE_FORMA };

  // Los repartos se van solos por el ON DELETE CASCADE.
  await db.batch([
    db.delete(gastos).where(and(eq(gastos.id, gastoId), eq(gastos.juntadaId, juntadaId))),
    tocarJuntada(juntadaId),
  ]);

  refrescar(slug);
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
  const juntadaId = leer.uuid(entrada, "juntadaId");
  const slug = leer.slug(entrada, "slug");
  if (!juntadaId || !slug) return { ok: false, error: ERROR_DE_FORMA };

  const nombre = leer.texto(entrada, "nombre", LARGO_NOMBRE);
  if (!nombre) return { ok: false, error: "Falta el nombre." };

  const [resumen] = await db
    .select({ cantidad: count(), ultimoOrden: max(participantes.orden) })
    .from(participantes)
    .where(eq(participantes.juntadaId, juntadaId));

  if ((resumen?.cantidad ?? 0) >= MAX_PARTICIPANTES) {
    return { ok: false, error: `Ya son ${MAX_PARTICIPANTES}, que es el máximo.` };
  }

  // El que se suma va al final del orden, y ahí se queda para siempre. Los gastos que ya
  // estaban NO se recalculan: quien no estaba cuando se compró la carne, no la paga.
  await db.batch([
    db.insert(participantes).values({
      id: crypto.randomUUID(),
      juntadaId,
      nombre,
      orden: (resumen?.ultimoOrden ?? -1) + 1,
    }),
    tocarJuntada(juntadaId),
  ]);

  refrescar(slug);
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
  const juntadaId = leer.uuid(entrada, "juntadaId");
  const slug = leer.slug(entrada, "slug");
  const participanteId = leer.uuid(entrada, "participanteId");
  // El vacío es válido: es como se borra un alias.
  const alias = leer.textoQuePuedeIrVacio(entrada, "alias", LARGO_ALIAS);
  if (!juntadaId || !slug || !participanteId || alias === null) {
    return { ok: false, error: ERROR_DE_FORMA };
  }

  const valido = await validarParticipantes(juntadaId, [participanteId]);
  if (!valido) return { ok: false, error: "Esa persona no es de esta juntada." };

  await db.batch([
    db
      .update(participantes)
      .set({ alias: alias || null })
      .where(eq(participantes.id, participanteId)),
    tocarJuntada(juntadaId),
  ]);

  refrescar(slug);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------------

/**
 * Registra una transferencia que ya ocurrió por fuera (RN-11).
 *
 * Tiene dos guardas, y las dos existen por el mismo motivo: un pago que no ocurrió invierte
 * los saldos en vez de saldarlos, y la invariante Σ(saldos)=0 aguanta igual, así que el error
 * es invisible para el motor. Por eso el chequeo va acá.
 *
 *  1. PAGO DUPLICADO — el error más probable en uso real: Beto transfiere y toca "Saldado";
 *     Ana ve que le llegó la plata y lo toca también. Ana pasa a deber todo lo que puso.
 *
 *  2. PANTALLA VIEJA — el que toca "Saldado" manda el monto que tenía renderizado. Si mientras
 *     tanto alguien cargó, editó o borró un gasto, ese número puede no tener nada que ver con
 *     lo que se debe ahora. Se compara contra los saldos reales del servidor.
 *
 * Ninguna de las dos rechaza de plano: devuelven `confirmable` para que la persona decida,
 * porque las dos tienen un caso legítimo (se transfirió dos veces lo mismo; se pagó de más
 * a propósito). El camino normal no ve ninguna de las dos.
 */
export async function marcarSaldado(entrada: {
  juntadaId: string;
  slug: string;
  deId: string;
  aId: string;
  montoCentavos: number;
  /** Viene en true cuando ya se avisó del problema y la persona decidió registrarlo igual. */
  confirmar?: boolean;
}): Promise<Resultado> {
  const juntadaId = leer.uuid(entrada, "juntadaId");
  const slug = leer.slug(entrada, "slug");
  const deId = leer.uuid(entrada, "deId");
  const aId = leer.uuid(entrada, "aId");
  if (!juntadaId || !slug || !deId || !aId) return { ok: false, error: ERROR_DE_FORMA };

  const montoCentavos = leer.centavos(entrada, "montoCentavos");
  if (!montoCentavos) return { ok: false, error: "Monto inválido." };

  if (deId === aId) return { ok: false, error: "No podés pagarte a vos mismo." };

  // Se trae la juntada entera y no solo los dos participantes: hace falta el estado REAL de
  // las cuentas para saber si lo que llegó sigue teniendo sentido. De paso valida que el id y
  // el slug sean de la misma juntada, que el resto de las acciones da por sentado.
  const juntada = await getJuntadaPorSlug(slug);
  if (!juntada || juntada.id !== juntadaId) {
    return { ok: false, error: "Esta juntada no existe." };
  }

  const de = juntada.saldos.find((s) => s.participanteId === deId);
  const a = juntada.saldos.find((s) => s.participanteId === aId);
  if (!de || !a) {
    return { ok: false, error: "Esas personas no son de esta juntada." };
  }

  if (!leer.bandera(entrada, "confirmar")) {
    const desde = new Date(Date.now() - VENTANA_PAGO_DUPLICADO_MS);
    const [previo] = await db
      .select({ id: pagos.id })
      .from(pagos)
      .where(
        and(
          eq(pagos.juntadaId, juntadaId),
          eq(pagos.deId, deId),
          eq(pagos.aId, aId),
          eq(pagos.montoCentavos, montoCentavos),
          gte(pagos.creadoEn, desde),
        ),
      )
      .limit(1);

    if (previo) {
      return {
        ok: false,
        confirmable: true,
        error:
          `Ya hay un pago de ${de.nombre} a ${a.nombre} por ` +
          `${formatearPesos(montoCentavos)} registrado hace un rato. ` +
          "Cargarlo de nuevo da vuelta los saldos.",
      };
    }

    // Contra los saldos de ahora, no contra los que se vieron en pantalla.
    const desfasaje =
      de.saldoCentavos >= 0
        ? `Según las cuentas de ahora, ${de.nombre} no le debe nada a nadie.`
        : a.saldoCentavos <= 0
          ? `Según las cuentas de ahora, a ${a.nombre} no le deben nada.`
          : montoCentavos > -de.saldoCentavos
            ? `${de.nombre} debe ${formatearPesos(-de.saldoCentavos)} en total, ` +
              `menos que los ${formatearPesos(montoCentavos)} que estás registrando.`
            : null;

    if (desfasaje) {
      return {
        ok: false,
        confirmable: true,
        error: `${desfasaje} Puede que alguien haya tocado algo mientras mirabas la pantalla.`,
      };
    }
  }

  await db.batch([
    db.insert(pagos).values({
      id: crypto.randomUUID(),
      juntadaId,
      deId,
      aId,
      montoCentavos,
    }),
    tocarJuntada(juntadaId),
  ]);

  refrescar(slug);
  return { ok: true };
}

export async function borrarPago(entrada: {
  juntadaId: string;
  slug: string;
  pagoId: string;
}): Promise<Resultado> {
  const juntadaId = leer.uuid(entrada, "juntadaId");
  const slug = leer.slug(entrada, "slug");
  const pagoId = leer.uuid(entrada, "pagoId");
  if (!juntadaId || !slug || !pagoId) return { ok: false, error: ERROR_DE_FORMA };

  await db.batch([
    db.delete(pagos).where(and(eq(pagos.id, pagoId), eq(pagos.juntadaId, juntadaId))),
    tocarJuntada(juntadaId),
  ]);

  refrescar(slug);
  return { ok: true };
}
