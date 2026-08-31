"use client";

import { useTransition } from "react";
import { borrarPago } from "@/lib/acciones";
import { formatearPesos } from "@/lib/dinero";
import type { Pago, Participante } from "@/lib/dominio/tipos";

/**
 * Los pagos ya marcados como saldados, con botón para deshacer.
 *
 * Existe porque "saldado" mueve plata en los saldos y cualquiera puede tocarlo sin
 * confirmación de la otra parte. Sin un deshacer, un toque equivocado deja la juntada
 * mal para siempre y no hay forma de arreglarlo sin entrar a la base.
 */
export function PagosRegistrados({
  juntadaId,
  slug,
  pagos,
  participantes,
}: {
  juntadaId: string;
  slug: string;
  pagos: Pago[];
  participantes: Participante[];
}) {
  const [borrando, iniciar] = useTransition();
  const nombrePorId = new Map(participantes.map((p) => [p.id, p.nombre]));

  if (pagos.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">
        Pagos registrados
      </h2>
      <ul className="flex flex-col gap-2">
        {pagos.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3"
          >
            <p className="min-w-0 truncate text-stone-600">
              <span className="font-medium text-stone-900">
                {nombrePorId.get(p.deId) ?? "alguien"}
              </span>{" "}
              le pagó {formatearPesos(p.montoCentavos)} a{" "}
              <span className="font-medium text-stone-900">
                {nombrePorId.get(p.aId) ?? "alguien"}
              </span>
            </p>
            <button
              disabled={borrando}
              onClick={() =>
                iniciar(async () => {
                  await borrarPago({ juntadaId, slug, pagoId: p.id });
                })
              }
              className="shrink-0 text-sm font-medium text-stone-500 active:text-red-700 disabled:opacity-50"
            >
              Deshacer
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
