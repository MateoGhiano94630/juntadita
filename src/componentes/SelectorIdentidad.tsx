"use client";

import type { Participante } from "@/lib/dominio/tipos";
import { Hoja } from "./Hoja";

/**
 * "¿Quién sos?" — lo primero que ve alguien que abre el link por primera vez.
 *
 * No es un login: es para preseleccionar quién paga y no tener que elegirlo en cada gasto.
 * Se guarda en el navegador y se puede cambiar cuando quiera.
 */
export function SelectorIdentidad({
  participantes,
  identidadId,
  onElegir,
  onCerrar,
}: {
  participantes: Participante[];
  identidadId: string | null;
  onElegir: (id: string) => void;
  onCerrar: () => void;
}) {
  return (
    <Hoja titulo="¿Quién sos?" onCerrar={onCerrar}>
      <div className="flex flex-col gap-2 pb-2">
        {participantes.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              onElegir(p.id);
              onCerrar();
            }}
            className={`flex items-center justify-between rounded-2xl px-5 py-4 text-left text-lg font-medium transition active:scale-[0.99] ${
              p.id === identidadId
                ? "bg-stone-900 text-white"
                : "bg-white text-stone-900 ring-1 ring-stone-200 ring-inset"
            }`}
          >
            {p.nombre}
            {p.id === identidadId ? <span className="text-sm opacity-70">vos</span> : null}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-stone-500">
        Queda guardado en este celular. Lo podés cambiar cuando quieras.
      </p>
    </Hoja>
  );
}
