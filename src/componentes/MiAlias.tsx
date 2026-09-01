"use client";

import { useState, useTransition } from "react";
import { guardarAlias } from "@/lib/acciones";
import type { ParticipanteUI } from "@/lib/consultas";

/**
 * Tu alias, para que te puedan transferir (RF-81).
 *
 * Sin esto la liquidación queda a mitad de camino: sabés que Nico te debe $8.400 y Nico
 * sabe que te los debe, pero para pagarte tiene que ir al grupo a pedirte el alias. Este
 * campo es lo que cierra el ciclo.
 *
 * La app no toca la plata (RN-11): esto es un texto que se copia y se pega en la billetera.
 */
export function MiAlias({
  juntadaId,
  slug,
  yo,
}: {
  juntadaId: string;
  slug: string;
  yo: ParticipanteUI;
}) {
  const [editando, setEditando] = useState(false);
  const [alias, setAlias] = useState(yo.alias ?? "");
  const [guardando, iniciar] = useTransition();

  const guardar = () => {
    iniciar(async () => {
      const resultado = await guardarAlias({
        juntadaId,
        slug,
        participanteId: yo.id,
        alias,
      });
      if (resultado.ok) setEditando(false);
    });
  };

  if (!editando) {
    return yo.alias ? (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
        <p className="min-w-0 text-stone-600">
          Tu alias: <span className="font-semibold text-stone-900">{yo.alias}</span>
        </p>
        <button
          onClick={() => setEditando(true)}
          className="shrink-0 text-sm font-medium text-stone-500 active:text-stone-900"
        >
          Cambiar
        </button>
      </div>
    ) : (
      <button
        onClick={() => setEditando(true)}
        className="w-full rounded-2xl border border-dashed border-stone-300 px-5 py-4 font-medium text-stone-500 active:bg-stone-200"
      >
        + Poné tu alias para que te transfieran
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-4">
      <label htmlFor="alias" className="text-sm font-medium text-stone-700">
        Tu alias o CVU
      </label>
      <div className="flex gap-2">
        <input
          id="alias"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          autoFocus
          maxLength={50}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          onKeyDown={(e) => {
            if (e.key === "Enter") guardar();
          }}
          placeholder="juan.perez.mp"
          className="min-w-0 flex-1 rounded-xl border border-stone-300 px-4 py-3 text-lg outline-none focus:border-stone-900"
        />
        <button
          onClick={guardar}
          disabled={guardando}
          className="shrink-0 rounded-xl bg-stone-900 px-5 font-semibold text-white disabled:opacity-50"
        >
          Guardar
        </button>
      </div>
      <p className="text-sm text-stone-500">
        Lo ve el resto de la juntada para poder transferirte. Dejalo vacío para borrarlo.
      </p>
      <button
        onClick={() => {
          setAlias(yo.alias ?? "");
          setEditando(false);
        }}
        className="self-start text-sm text-stone-500 underline underline-offset-2"
      >
        Cancelar
      </button>
    </div>
  );
}
