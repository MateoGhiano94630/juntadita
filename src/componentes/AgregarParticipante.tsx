"use client";

import { useState, useTransition } from "react";
import { agregarParticipante } from "@/lib/acciones";

/** Para el que cayó de sorpresa y no estaba en la lista original. */
export function AgregarParticipante({ juntadaId, slug }: { juntadaId: string; slug: string }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full rounded-2xl border border-dashed border-stone-300 px-6 py-4 font-medium text-stone-500 active:bg-stone-200"
      >
        + Cayó alguien más
      </button>
    );
  }

  const guardar = () => {
    if (!nombre.trim()) {
      setError("Poné el nombre.");
      return;
    }
    iniciar(async () => {
      const resultado = await agregarParticipante({ juntadaId, slug, nombre });
      if (resultado.ok) {
        setNombre("");
        setAbierto(false);
        setError(null);
      } else {
        setError(resultado.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-4">
      <div className="flex gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoFocus
          maxLength={80}
          enterKeyHint="done"
          onKeyDown={(e) => {
            if (e.key === "Enter") guardar();
          }}
          placeholder="Nombre"
          className="min-w-0 flex-1 rounded-xl border border-stone-300 px-4 py-3 text-lg outline-none focus:border-stone-900"
        />
        <button
          onClick={guardar}
          disabled={guardando}
          className="shrink-0 rounded-xl bg-stone-900 px-5 font-semibold text-white disabled:opacity-50"
        >
          Sumar
        </button>
      </div>
      <p className="text-sm text-stone-500">
        Se suma para los gastos nuevos. Los que ya estaban cargados no cambian.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        onClick={() => {
          setAbierto(false);
          setError(null);
        }}
        className="self-start text-sm text-stone-500 underline underline-offset-2"
      >
        Cancelar
      </button>
    </div>
  );
}
