/**
 * Tipos del motor de dominio.
 *
 * Este módulo (y todo `src/lib/dominio/`) es puro: no conoce Next, ni React,
 * ni la base de datos. Restricción A1 del documento de diseño.
 *
 * TODOS los montos son enteros de centavos. Nunca punto flotante. RN-12.
 */

export type ParticipanteId = string;

export interface Participante {
  id: ParticipanteId;
  nombre: string;
  /** Orden estable de incorporación a la juntada. Define el reparto del residuo (RN-02). */
  orden: number;
}

/** Lo que le toca a una persona de un gasto, resuelto en monto absoluto (RN-01). */
export interface Reparto {
  participanteId: ParticipanteId;
  montoCentavos: number;
}

export interface Gasto {
  id: string;
  descripcion: string;
  montoCentavos: number;
  pagadorId: ParticipanteId;
  /** Suma exactamente `montoCentavos`. Es la invariante que sostiene todo lo demás. */
  repartos: Reparto[];
}

/** Una transferencia que ya ocurrió por fuera del sistema. Nunca custodiamos plata (RN-11). */
export interface Pago {
  id: string;
  /** Quién puso la plata. */
  deId: ParticipanteId;
  /** Quién la recibió. */
  aId: ParticipanteId;
  montoCentavos: number;
}

export interface Saldo {
  participanteId: ParticipanteId;
  nombre: string;
  orden: number;
  /** Σ de los gastos que pagó. */
  puestoCentavos: number;
  /** Σ de lo que le corresponde de todos los gastos. */
  correspondeCentavos: number;
  /** Positivo: le deben. Negativo: debe. La suma de todos da exactamente cero (RN-03). */
  saldoCentavos: number;
}

/** Una transferencia sugerida para saldar. Todavía no ocurrió. */
export interface Transferencia {
  deId: ParticipanteId;
  deNombre: string;
  aId: ParticipanteId;
  aNombre: string;
  montoCentavos: number;
}
