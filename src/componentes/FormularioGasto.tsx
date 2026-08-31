"use client";

import { useState, useTransition } from "react";
import { agregarGasto, editarGasto } from "@/lib/acciones";
import { centavosAInput, formatearPesos, parsearPesos } from "@/lib/dinero";
import type { Gasto, Participante } from "@/lib/dominio/tipos";
import { Hoja } from "./Hoja";

/**
 * Cargar un gasto tiene un presupuesto duro: menos de 10 segundos y no más de 4 toques
 * (RNF-01). El camino feliz es tocar "+ Gasto", tipear el monto (el foco ya está ahí),
 * tocar la descripción, y confirmar.
 *
 * Todo lo demás viene preseleccionado: paga el que está mirando, participan todos.
 * Quien necesite cambiarlo lo cambia; el resto no toca nada.
 */
export function FormularioGasto({
  juntadaId,
  slug,
  participantes,
  identidadId,
  gasto,
  onCerrar,
}: {
  juntadaId: string;
  slug: string;
  participantes: Participante[];
  identidadId: string | null;
  /** Si viene, es edición. Si no, es alta. */
  gasto?: Gasto;
  onCerrar: () => void;
}) {
  const esEdicion = Boolean(gasto);

  const [montoTexto, setMontoTexto] = useState(
    gasto ? centavosAInput(gasto.montoCentavos) : "",
  );
  const [descripcion, setDescripcion] = useState(gasto?.descripcion ?? "");
  const [pagadorId, setPagadorId] = useState(
    gasto?.pagadorId ?? identidadId ?? participantes[0]?.id ?? "",
  );
  const [incluidos, setIncluidos] = useState<Set<string>>(
    () =>
      new Set(
        gasto ? gasto.repartos.map((r) => r.participanteId) : participantes.map((p) => p.id),
      ),
  );
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const montoCentavos = parsearPesos(montoTexto);

  const alternar = (id: string) => {
    setIncluidos((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  };

  const confirmar = () => {
    if (!montoCentavos || montoCentavos <= 0) {
      setError("Poné cuánto salió.");
      return;
    }
    if (!descripcion.trim()) {
      setError("¿Qué fue? Poné una descripción corta.");
      return;
    }
    if (incluidos.size === 0) {
      setError("Tildá al menos a una persona.");
      return;
    }

    iniciar(async () => {
      const entrada = {
        juntadaId,
        slug,
        descripcion,
        montoCentavos,
        pagadorId,
        participanteIds: [...incluidos],
      };
      const resultado = gasto
        ? await editarGasto({ ...entrada, gastoId: gasto.id })
        : await agregarGasto(entrada);

      if (resultado.ok) onCerrar();
      else setError(resultado.error);
    });
  };

  const todosTildados = incluidos.size === participantes.length;

  return (
    <Hoja titulo={esEdicion ? "Editar gasto" : "Nuevo gasto"} onCerrar={onCerrar}>
      <div className="flex flex-col gap-6">
        {/* Monto: primer campo, foco automático, teclado numérico. */}
        <div>
          <label htmlFor="monto" className="text-sm font-medium text-stone-700">
            ¿Cuánto salió?
          </label>
          <div className="mt-2 flex items-baseline gap-2 rounded-2xl border border-stone-300 bg-white px-4 py-3 focus-within:border-stone-900">
            <span className="text-3xl font-bold text-stone-400">$</span>
            <input
              id="monto"
              value={montoTexto}
              onChange={(e) => setMontoTexto(e.target.value)}
              autoFocus={!esEdicion}
              inputMode="decimal"
              enterKeyHint="next"
              placeholder="0"
              className="w-full bg-transparent text-4xl font-bold outline-none placeholder:text-stone-300"
            />
          </div>
          {/* Devuelve el monto ya interpretado: confirma que "10.000" son diez mil y no diez. */}
          <p className="mt-1.5 h-5 text-sm text-stone-500">
            {montoCentavos ? formatearPesos(montoCentavos) : ""}
          </p>
        </div>

        <div>
          <label htmlFor="descripcion" className="text-sm font-medium text-stone-700">
            ¿Qué fue?
          </label>
          <input
            id="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={80}
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmar();
            }}
            placeholder="Carne, bebida, hielo…"
            className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3.5 text-lg outline-none focus:border-stone-900"
          />
        </div>

        <Seleccion titulo="¿Quién puso la plata?">
          {participantes.map((p) => (
            <Chip
              key={p.id}
              activo={p.id === pagadorId}
              onClick={() => setPagadorId(p.id)}
              texto={p.nombre}
            />
          ))}
        </Seleccion>

        <Seleccion
          titulo="¿Entre quiénes se divide?"
          accion={
            <button
              type="button"
              onClick={() =>
                setIncluidos(todosTildados ? new Set() : new Set(participantes.map((p) => p.id)))
              }
              className="text-sm font-medium text-stone-500 underline underline-offset-2"
            >
              {todosTildados ? "Ninguno" : "Todos"}
            </button>
          }
        >
          {participantes.map((p) => (
            <Chip
              key={p.id}
              activo={incluidos.has(p.id)}
              onClick={() => alternar(p.id)}
              texto={p.nombre}
            />
          ))}
        </Seleccion>

        {montoCentavos && incluidos.size > 0 ? (
          <p className="text-sm text-stone-500">
            Le toca {formatearPesos(Math.floor(montoCentavos / incluidos.size))} a cada uno
            {montoCentavos % incluidos.size !== 0 ? " (más el vuelto, que va al que pagó)" : ""}.
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={confirmar}
          disabled={enviando}
          className="w-full rounded-2xl bg-stone-900 px-6 py-4 text-lg font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {enviando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Confirmar"}
        </button>
      </div>
    </Hoja>
  );
}

function Seleccion({
  titulo,
  accion,
  children,
}: {
  titulo: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-stone-700">{titulo}</span>
        {accion}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  activo,
  onClick,
  texto,
}: {
  activo: boolean;
  onClick: () => void;
  texto: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-full px-4 py-2.5 text-base font-medium transition active:scale-95 ${
        activo
          ? "bg-stone-900 text-white"
          : "bg-white text-stone-500 ring-1 ring-stone-300 ring-inset"
      }`}
    >
      {texto}
    </button>
  );
}
