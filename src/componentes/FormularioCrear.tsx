"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { crearJuntada, type EstadoCrear } from "@/lib/acciones";

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-stone-900 px-6 py-4 text-lg font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? "Creando…" : "Crear juntada"}
    </button>
  );
}

export function FormularioCrear() {
  const [estado, accion] = useActionState<EstadoCrear, FormData>(crearJuntada, {});

  return (
    <form action={accion} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-stone-700">¿Cómo le decimos?</span>
        <input
          name="nombre"
          required
          autoFocus
          maxLength={80}
          placeholder="Asado del sábado"
          className="rounded-2xl border border-stone-300 bg-white px-4 py-4 text-lg outline-none focus:border-stone-900"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-stone-700">¿Quiénes van?</span>
        <textarea
          name="participantes"
          required
          rows={6}
          placeholder={"Juan\nAna\nNico\nSofi"}
          className="resize-none rounded-2xl border border-stone-300 bg-white px-4 py-4 text-lg outline-none focus:border-stone-900"
        />
        <span className="text-sm text-stone-500">
          Uno por línea, o separados por coma. Después podés sumar a los que caigan de más.
        </span>
      </label>

      {estado.error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-red-700">
          {estado.error}
        </p>
      ) : null}

      <Boton />
    </form>
  );
}
