import type { Gasto, Pago, Participante, Saldo } from "./tipos";

/**
 * Calcula el saldo de cada participante (RN-03).
 *
 *   saldo = Σ(lo que pagó en gastos) − Σ(lo que le corresponde)
 *           + Σ(pagos que hizo) − Σ(pagos que recibió)
 *
 * Convención: saldo positivo = le deben. Negativo = debe.
 *
 * ⚠ OJO — esto invierte el signo de los pagos respecto de cómo está escrita la fórmula en
 * el pedido y en RN-03 del documento de diseño, que dicen `+ recibidos − hechos`. Esa
 * versión da la invariante en cero igual (por eso el error pasa desapercibido) pero
 * duplica la deuda en vez de cancelarla:
 *
 *   A paga $100 de una cena a medias con B  →  A: +50, B: −50
 *   B le transfiere $50 a A                 →  ambos tienen que quedar en 0
 *
 *   Con `+ recibidos − hechos`:  A = 100 − 50 + 50 = +100,  B = 0 − 50 − 50 = −100
 *   Con `+ hechos − recibidos`:  A = 100 − 50 − 50 =    0,  B = 0 − 50 + 50 =    0  ✓
 *
 * Con la fórmula del pedido, marcar "saldado" empeora la deuda y la liquidación te pide
 * pagar de nuevo, para siempre. Se implementa la versión corregida.
 *
 * El saldo se deriva SIEMPRE, nunca se guarda (§5.3 / A4). Un campo de saldo mutable es
 * una fuente garantizada de descuadres.
 *
 * Invariante: Σ(saldos) === 0, exacto. Se sostiene porque cada gasto reparte exactamente
 * su monto (ver `repartirIgual`) y cada pago suma de un lado lo que resta del otro.
 */
export function calcularSaldos(
  participantes: Participante[],
  gastos: Gasto[],
  pagos: Pago[],
): Saldo[] {
  const enOrden = [...participantes].sort((a, b) => a.orden - b.orden || (a.id < b.id ? -1 : 1));

  const puesto = new Map<string, number>();
  const corresponde = new Map<string, number>();
  const neto = new Map<string, number>();
  for (const p of enOrden) {
    puesto.set(p.id, 0);
    corresponde.set(p.id, 0);
    neto.set(p.id, 0);
  }

  // Si una referencia no existe, el invariante se rompería en silencio. Preferimos romper fuerte.
  const sumar = (mapa: Map<string, number>, id: string, monto: number, contexto: string) => {
    const actual = mapa.get(id);
    if (actual === undefined) {
      throw new Error(`${contexto} referencia a un participante que no está en la juntada: ${id}`);
    }
    mapa.set(id, actual + monto);
  };

  for (const gasto of gastos) {
    sumar(puesto, gasto.pagadorId, gasto.montoCentavos, `El gasto "${gasto.descripcion}"`);
    for (const reparto of gasto.repartos) {
      sumar(
        corresponde,
        reparto.participanteId,
        reparto.montoCentavos,
        `El reparto del gasto "${gasto.descripcion}"`,
      );
    }
  }

  for (const pago of pagos) {
    // El que transfiere cancela deuda: su saldo sube hacia cero.
    // El que cobra deja de tener plata a favor: su saldo baja hacia cero.
    sumar(neto, pago.deId, pago.montoCentavos, "Un pago");
    sumar(neto, pago.aId, -pago.montoCentavos, "Un pago");
  }

  return enOrden.map((p) => {
    const puestoCentavos = puesto.get(p.id)!;
    const correspondeCentavos = corresponde.get(p.id)!;
    return {
      participanteId: p.id,
      nombre: p.nombre,
      orden: p.orden,
      puestoCentavos,
      correspondeCentavos,
      saldoCentavos: puestoCentavos - correspondeCentavos + neto.get(p.id)!,
    };
  });
}

/** Σ de todos los gastos de la juntada, en centavos. */
export function totalGastado(gastos: Gasto[]): number {
  return gastos.reduce((acc, g) => acc + g.montoCentavos, 0);
}
