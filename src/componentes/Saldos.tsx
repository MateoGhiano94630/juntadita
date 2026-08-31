import { formatearPesos } from "@/lib/dinero";
import type { Saldo } from "@/lib/dominio/tipos";

/** Cuánto puso y cuánto le corresponde a cada uno. La suma de la columna da cero (RN-03). */
export function Saldos({ saldos }: { saldos: Saldo[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {saldos.map((s) => {
        const aFavor = s.saldoCentavos > 0;
        const saldado = s.saldoCentavos === 0;

        return (
          <li key={s.participanteId} className="rounded-2xl bg-white px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate font-semibold">{s.nombre}</p>
              <p
                className={`shrink-0 text-xl font-bold ${
                  saldado ? "text-stone-400" : aFavor ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {saldado
                  ? "al día"
                  : `${aFavor ? "+" : "−"}${formatearPesos(Math.abs(s.saldoCentavos))}`}
              </p>
            </div>
            <p className="mt-0.5 text-sm text-stone-500">
              Puso {formatearPesos(s.puestoCentavos)} · le toca{" "}
              {formatearPesos(s.correspondeCentavos)}
              {saldado ? "" : aFavor ? " · le deben" : " · debe"}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
