"use client";

import { useEffect, useState } from "react";
import { compartirNativo, copiarAlPortapapeles, hayCompartirNativo } from "@/lib/copiar";

/**
 * Manda el mensaje armado al grupo.
 *
 * En celular usa el selector nativo del sistema (RF-92): abre WhatsApp directo en vez de
 * copiar → salir de la app → entrar a WhatsApp → pegar. Son tres pasos menos justo sobre
 * el camino crítico de la hipótesis que estamos midiendo.
 *
 * Si no hay share nativo (escritorio), copia. Si tampoco se puede copiar (pasa fuera de
 * https, que es exactamente el caso de probar con un túnel), muestra el texto para
 * seleccionarlo a mano.
 */
export function BotonCompartir({ mensaje }: { mensaje: string }) {
  const [copiado, setCopiado] = useState(false);
  const [manual, setManual] = useState(false);
  const [nativo, setNativo] = useState(false);

  // Se resuelve después de montar: en el servidor no hay `navigator` y el botón cambia
  // de texto según lo que soporte el aparato.
  useEffect(() => setNativo(hayCompartirNativo()), []);

  const compartir = async () => {
    if (await compartirNativo(mensaje)) return;

    if (await copiarAlPortapapeles(mensaje)) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      return;
    }
    setManual(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={compartir}
        className="w-full rounded-2xl bg-emerald-700 px-6 py-4 text-lg font-semibold text-white transition active:scale-[0.98]"
      >
        {copiado ? "¡Copiado!" : nativo ? "Compartir al grupo" : "Copiar para el grupo"}
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
