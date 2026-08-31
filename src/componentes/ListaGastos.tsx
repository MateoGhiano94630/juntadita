"use client";

import { useState, useTransition } from "react";
import { borrarGasto } from "@/lib/acciones";
import { formatearPesos } from "@/lib/dinero";
import type { Gasto, Participante } from "@/lib/dominio/tipos";
import { FormularioGasto } from "./FormularioGasto";

export function ListaGastos({
  juntadaId,
  slug,
  gastos,
  participantes,
  identidadId,
}: {
  juntadaId: string;
  slug: string;
  gastos: Gasto[];
  participantes: Participante[];
  identidadId: string | null;
}) {
  const [editando, setEditando] = useState<Gasto | null>(null);
  const [borrando, iniciarBorrado] = useTransition();
  const nombrePorId = new Map(participantes.map((p) => [p.id, p.nombre]));

  if (gastos.length === 0) {
    return (
      <p className="rounded-2xl bg-white px-5 py-6 text-center text-stone-500">
        Todavía no cargó nadie nada. Empezá vos.
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {gastos.map((g) => (
          <li key={g.id} className="rounded-2xl bg-white px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-stone-900">{g.descripcion}</p>
                <p className="mt-0.5 text-sm text-stone-500">
                  Puso {nombrePorId.get(g.pagadorId) ?? "alguien"} · entre {g.repartos.length}
                </p>
              </div>
              <p className="shrink-0 text-xl font-bold">{formatearPesos(g.montoCentavos)}</p>
            </div>

            <div className="mt-2 flex gap-4 border-t border-stone-100 pt-2">
              <button
                onClick={() => setEditando(g)}
                className="text-sm font-medium text-stone-500 active:text-stone-900"
              >
                Editar
              </button>
              <button
                disabled={borrando}
                onClick={() => {
                  if (!confirm(`¿Borrar "${g.descripcion}"?`)) return;
                  iniciarBorrado(async () => {
                    await borrarGasto({ juntadaId, slug, gastoId: g.id });
                  });
                }}
                className="text-sm font-medium text-stone-500 active:text-red-700 disabled:opacity-50"
              >
                Borrar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editando ? (
        <FormularioGasto
          juntadaId={juntadaId}
          slug={slug}
          participantes={participantes}
          identidadId={identidadId}
          gasto={editando}
          onCerrar={() => setEditando(null)}
        />
      ) : null}
    </>
  );
}
