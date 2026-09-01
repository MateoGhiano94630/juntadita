"use client";

import { useState, useTransition } from "react";
import { marcarSaldado } from "@/lib/acciones";
import type { ParticipanteUI } from "@/lib/consultas";
import { copiarAlPortapapeles } from "@/lib/copiar";
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
  participantes,
  hayGastos,
}: {
  juntadaId: string;
  slug: string;
  transferencias: Transferencia[];
  participantes: ParticipanteUI[];
  hayGastos: boolean;
}) {
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const aliasPorId = new Map(participantes.map((p) => [p.id, p.alias]));

  const saldar = (t: Transferencia) =>
    iniciar(async () => {
      setError(null);
      const entrada = {
        juntadaId,
        slug,
        deId: t.deId,
        aId: t.aId,
        montoCentavos: t.montoCentavos,
      };

      let resultado = await marcarSaldado(entrada);

      // El servidor no está seguro: o ya hay un pago igual, o los saldos de ahora no son los
      // que se vieron en pantalla. Ninguno de los dos es imposible, así que decide la persona.
      if (!resultado.ok && resultado.confirmable) {
        if (!confirm(`${resultado.error}\n\n¿Registrarlo igual?`)) return;
        resultado = await marcarSaldado({ ...entrada, confirmar: true });
      }

      if (!resultado.ok) setError(resultado.error);
    });

  if (transferencias.length === 0) {
    return (
      <p className="rounded-2xl bg-white px-5 py-6 text-center text-stone-500">
        {hayGastos
          ? "Está todo saldado. No queda nada por transferir."
          : "Cargá un gasto y acá aparece quién le paga a quién."}
      </p>
    );
  }

  return (
    <>
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-red-700">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {transferencias.map((t) => {
          const alias = aliasPorId.get(t.aId) ?? null;

          return (
            <li key={`${t.deId}-${t.aId}`} className="rounded-2xl bg-white px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {t.deNombre} <span className="text-stone-400">→</span> {t.aNombre}
                  </p>
                  <p className="text-xl font-bold">{formatearPesos(t.montoCentavos)}</p>
                </div>
                <button
                  disabled={guardando}
                  onClick={() => saldar(t)}
                  className="shrink-0 rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50"
                >
                  Saldado
                </button>
              </div>

              {/* El alias del que cobra, acá mismo: sin esto hay que ir al grupo a pedirlo. */}
              {alias ? (
                <CopiarAlias nombre={t.aNombre} alias={alias} />
              ) : (
                <p className="mt-2 border-t border-stone-100 pt-2 text-sm text-stone-400">
                  {t.aNombre} todavía no cargó su alias.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function CopiarAlias({ nombre, alias }: { nombre: string; alias: string }) {
  const [copiado, setCopiado] = useState(false);
  const [manual, setManual] = useState(false);

  return (
    <div className="mt-2 border-t border-stone-100 pt-2">
      <button
        onClick={async () => {
          if (await copiarAlPortapapeles(alias)) {
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          } else {
            setManual(true);
          }
        }}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="min-w-0 truncate text-sm text-stone-500">
          Alias de {nombre}: <span className="font-medium text-stone-700">{alias}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-emerald-700">
          {copiado ? "¡Copiado!" : "Copiar"}
        </span>
      </button>
      {manual ? (
        <input
          readOnly
          value={alias}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2 font-mono text-sm"
        />
      ) : null}
    </div>
  );
}
