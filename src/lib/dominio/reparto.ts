import type { Participante, ParticipanteId, Reparto } from "./tipos";

/**
 * Reparte un gasto en partes iguales entre los participantes incluidos (RN-01 `IGUAL`, RN-02).
 *
 * La regla que no se negocia: **la suma de las partes es exactamente el monto del gasto**.
 * Ni un centavo de más ni de menos, para cualquier monto y cualquier cantidad de gente.
 *
 * Procedimiento:
 *  1. Se divide en centavos y se trunca hacia abajo.
 *  2. El residuo (siempre menor a la cantidad de participantes) se reparte de a un centavo,
 *     empezando por el que pagó y siguiendo por orden de incorporación.
 *
 * Que arranque por el pagador no es arbitrario: es el que puso la plata, así que si alguien
 * tiene que cargar con el centavo de más, que sea él. Y como el orden es estable, dos
 * recálculos del mismo gasto dan siempre el mismo resultado.
 *
 * Ojo con un caso que la regla no cubre: cuando el pagador NO participa del gasto (Ana paga
 * un remís que usan Beto y Caro) no hay a quién darle el centavo por haber puesto la plata,
 * y cae en el primero por orden de incorporación. Sigue siendo determinístico y sigue sumando
 * exacto, pero es sistemático: en una juntada con muchos gastos así, el centavo lo come
 * siempre la misma persona. Son centavos, no vale la pena resolverlo; vale la pena saberlo.
 */
export function repartirIgual(
  montoCentavos: number,
  incluidos: Participante[],
  pagadorId: ParticipanteId,
): Reparto[] {
  if (!Number.isSafeInteger(montoCentavos)) {
    throw new Error(`El monto tiene que ser un entero de centavos, llegó: ${montoCentavos}`);
  }
  if (montoCentavos <= 0) {
    throw new Error(`El monto tiene que ser mayor a cero, llegó: ${montoCentavos}`);
  }
  if (incluidos.length === 0) {
    throw new Error("Un gasto necesita al menos un participante");
  }
  if (new Set(incluidos.map((p) => p.id)).size !== incluidos.length) {
    throw new Error("Hay participantes repetidos en el reparto");
  }

  // Orden estable. El desempate por id es defensivo: si dos filas quedaran con el mismo
  // `orden`, el resultado tiene que seguir siendo determinístico igual.
  const enOrden = [...incluidos].sort((a, b) => a.orden - b.orden || (a.id < b.id ? -1 : 1));

  const n = enOrden.length;
  const base = Math.floor(montoCentavos / n);
  const residuo = montoCentavos - base * n; // 0 <= residuo < n

  // La cola del residuo: primero el pagador si participa del gasto; si no, arranca por el
  // primero por orden y el filtro de arriba queda vacío.
  const cola = [
    ...enOrden.filter((p) => p.id === pagadorId),
    ...enOrden.filter((p) => p.id !== pagadorId),
  ];
  const conCentavoExtra = new Set(cola.slice(0, residuo).map((p) => p.id));

  return enOrden.map((p) => ({
    participanteId: p.id,
    montoCentavos: base + (conCentavoExtra.has(p.id) ? 1 : 0),
  }));
}
