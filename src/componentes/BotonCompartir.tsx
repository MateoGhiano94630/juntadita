"use client";

import { useState } from "react";

/**
 * Copia el mensaje armado para pegarlo en el grupo.
 *
 * El fallback del textarea no es paranoia: `navigator.clipboard` no existe fuera de
 * contexto seguro, y probar el preview con un túnel http o una IP de la red local es
 * exactamente el escenario donde se cae.
 */
export function BotonCompartir({ mensaje }: { mensaje: string }) {
  const [copiado, setCopiado] = useState(false);
  const [manual, setManual] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setManual(true);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={copiar}
        className="w-full rounded-2xl bg-emerald-700 px-6 py-4 text-lg font-semibold text-white transition active:scale-[0.98]"
      >
        {copiado ? "¡Copiado!" : "Compartir al grupo"}
      </button>

      {manual ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-stone-500">
            El navegador no dejó copiar solo. Seleccioná el texto y copialo a mano:
          </p>
          <textarea
            readOnly
            value={mensaje}
            rows={8}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 font-mono text-sm"
          />
        </div>
      ) : null}
    </div>
  );
}
