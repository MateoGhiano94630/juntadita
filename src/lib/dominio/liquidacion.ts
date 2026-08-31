import type { Saldo, Transferencia } from "./tipos";

/**
 * Calcula el conjunto mínimo de transferencias que salda a todos (RN-06).
 *
 * Se ordenan deudores y acreedores por monto descendente y se van emparejando de a pares,
 * cancelando en cada paso `min(deuda, crédito)`. Cada iteración deja al menos a uno en cero,
 * así que salen a lo sumo n−1 transferencias contra las n² del "cada uno le paga a cada uno".
 *
 * Determinístico ante empates: el desempate es por orden de incorporación, que nunca cambia.
 * Dos personas mirando la pantalla al mismo tiempo ven exactamente la misma lista.
 *
 * Nota honesta: el óptimo global de este problema es NP-hard. Esto es el greedy estándar
 * (el que describe el pedido), que no siempre da el mínimo absoluto de transferencias pero
 * sí siempre salda a todos y nunca genera una transferencia hacia alguien ya saldado.
 *
 * Depende de que Σ(saldos) === 0, que es lo que garantiza `calcularSaldos`.
 */
export function liquidacionMinima(saldos: Saldo[]): Transferencia[] {
  const porMontoYOrden = <T extends { resto: number; orden: number }>(a: T, b: T) =>
    b.resto - a.resto || a.orden - b.orden;

  const deudores = saldos
    .filter((s) => s.saldoCentavos < 0)
    .map((s) => ({ ...s, resto: -s.saldoCentavos }))
    .sort(porMontoYOrden);

  const acreedores = saldos
    .filter((s) => s.saldoCentavos > 0)
    .map((s) => ({ ...s, resto: s.saldoCentavos }))
    .sort(porMontoYOrden);

  const transferencias: Transferencia[] = [];
  let i = 0;
  let j = 0;

  while (i < deudores.length && j < acreedores.length) {
    const deudor = deudores[i];
    const acreedor = acreedores[j];
    const monto = Math.min(deudor.resto, acreedor.resto);

    if (monto > 0) {
      transferencias.push({
        deId: deudor.participanteId,
        deNombre: deudor.nombre,
        aId: acreedor.participanteId,
        aNombre: acreedor.nombre,
        montoCentavos: monto,
      });
    }

    deudor.resto -= monto;
    acreedor.resto -= monto;
    if (deudor.resto === 0) i++;
    if (acreedor.resto === 0) j++;
  }

  return transferencias;
}
