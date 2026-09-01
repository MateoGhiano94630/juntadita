"use client";

import { formatearPesos } from "@/lib/dinero";
import type { Saldo, Transferencia } from "@/lib/dominio/tipos";

/**
 * Tu propio saldo, arriba de todo y en grande.
 *
 * Es la única pregunta que se hace el que abre el link: *¿yo cuánto debo?* (JTBD-4).
 * Antes había que buscarse en la lista de saldos; acá está resuelto de un vistazo.
 * No hay dato nuevo: sale de lo que ya calculó el motor.
 */
export function MiSaldo({
  saldo,
  liquidacion,
}: {
  saldo: Saldo;
  liquidacion: Transferencia[];
}) {
  const debe = saldo.saldoCentavos < 0;
  const leDeben = saldo.saldoCentavos > 0;

  if (!debe && !leDeben) {
    return (
      <div className="rounded-2xl bg-white px-5 py-4">
        <p className="text-sm text-stone-500">Lo tuyo</p>
        <p className="mt-0.5 text-2xl font-bold text-stone-500">Estás al día</p>
      </div>
    );
  }

  // A quién le tiene que transferir, según la liquidación que ya está calculada.
  const misTransferencias = liquidacion.filter((t) => t.deId === saldo.participanteId);
  const aQuien =
    misTransferencias.length === 1
      ? `a ${misTransferencias[0].aNombre}`
      : misTransferencias.length > 1
        ? `a ${misTransferencias.length} personas`
        : null;

  return (
    <div
      className={`rounded-2xl px-5 py-4 ${debe ? "bg-red-50" : "bg-emerald-50"}`}
    >
      <p className={`text-sm ${debe ? "text-red-800/70" : "text-emerald-900/70"}`}>Lo tuyo</p>
      <p
        className={`mt-0.5 text-4xl font-black tracking-tight ${
          debe ? "text-red-800" : "text-emerald-800"
        }`}
      >
        {debe ? "Debés " : "Te deben "}
        {formatearPesos(Math.abs(saldo.saldoCentavos))}
      </p>
      {debe && aQuien ? (
        <p className="mt-1 text-red-800/80">{aQuien}</p>
      ) : null}
    </div>
  );
}
