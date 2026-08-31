"use client";

import { useTransition } from "react";
import { marcarSaldado } from "@/lib/acciones";
import { formatearPesos } from "@/lib/dinero";
import type { Transferencia } from "@/lib/dominio/tipos";

/**
 * Quién le paga a quién: la liquidación mínima (RN-06).
 *
 * "Saldado" escribe un pago de verdad y los saldos se recalculan solos, así que la línea
 * desaparece de acá y aparece en "Pagos registrados", donde se puede deshacer.
 */
export function Liquidacion({
  juntadaId,
  slug,
  transferencias,
  hayGastos,
}: {
  juntadaId: string;
  slug: string;
  transferencias: Transferencia[];
  hayGastos: boolean;
}) {
  const [guardando, iniciar] = useTransition();

  if (transferencias.length === 0) {
    return (
      <p className="rounded-2xl bg-white px-5 py-6 text-center text-stone-500">
        {hayGastos ? "Está todo saldado. No queda nada por transferir." : "Cargá un gasto y acá aparece quién le paga a quién."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {transferencias.map((t) => (
        <li
          key={`${t.deId}-${t.aId}`}
          className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5"
        >
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {t.deNombre} <span className="text-stone-400">→</span> {t.aNombre}
            </p>
            <p className="text-xl font-bold">{formatearPesos(t.montoCentavos)}</p>
          </div>
          <button
            disabled={guardando}
            onClick={() =>
              iniciar(async () => {
                await marcarSaldado({
                  juntadaId,
                  slug,
                  deId: t.deId,
                  aId: t.aId,
                  montoCentavos: t.montoCentavos,
                });
              })
            }
            className="shrink-0 rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50"
          >
            Saldado
          </button>
        </li>
      ))}
    </ul>
  );
}
