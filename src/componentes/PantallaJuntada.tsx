"use client";

import { useEffect, useState } from "react";
import { formatearPesos } from "@/lib/dinero";
import type { JuntadaCompleta } from "@/lib/consultas";
import { useIdentidad, useRefrescoAlVolver } from "@/lib/hooks";
import { armarMensaje } from "@/lib/whatsapp";
import { AgregarParticipante } from "./AgregarParticipante";
import { BotonCompartir } from "./BotonCompartir";
import { FormularioGasto } from "./FormularioGasto";
import { ListaGastos } from "./ListaGastos";
import { Liquidacion } from "./Liquidacion";
import { MiAlias } from "./MiAlias";
import { MiSaldo } from "./MiSaldo";
import { PagosRegistrados } from "./PagosRegistrados";
import { Saldos } from "./Saldos";
import { SelectorIdentidad } from "./SelectorIdentidad";

export function PantallaJuntada({ juntada, url }: { juntada: JuntadaCompleta; url: string }) {
  const { id: identidadId, listo, elegir } = useIdentidad(juntada.slug, juntada.participantes);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [gastoAbierto, setGastoAbierto] = useState(false);

  useRefrescoAlVolver();

  // Primera visita: se pregunta quién sos apenas se sabe que no hay nada guardado.
  useEffect(() => {
    if (listo && !identidadId) setSelectorAbierto(true);
  }, [listo, identidadId]);

  const yo = juntada.participantes.find((p) => p.id === identidadId);
  const miSaldo = juntada.saldos.find((s) => s.participanteId === identidadId);

  const mensaje = armarMensaje({
    nombre: juntada.nombre,
    totalCentavos: juntada.totalCentavos,
    cantidadPersonas: juntada.participantes.length,
    transferencias: juntada.liquidacion,
    url,
  });

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6 pb-28">
      {/* El total es el dato más importante de la pantalla: se lee de un vistazo. */}
      <header className="px-1">
        <h1 className="text-2xl font-bold tracking-tight">{juntada.nombre}</h1>
        <p className="mt-1 text-5xl font-black tracking-tight tabular-nums">
          {formatearPesos(juntada.totalCentavos)}
        </p>
        <p className="mt-1 text-stone-500">
          {juntada.participantes.length}{" "}
          {juntada.participantes.length === 1 ? "persona" : "personas"} ·{" "}
          {juntada.gastos.length} {juntada.gastos.length === 1 ? "gasto" : "gastos"}
        </p>

        <button
          onClick={() => setSelectorAbierto(true)}
          className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-medium text-stone-600 ring-1 ring-stone-200 ring-inset active:bg-stone-200"
        >
          {listo && yo ? `Sos ${yo.nombre} · cambiar` : "¿Quién sos?"}
        </button>
      </header>

      {/* Lo primero después del total: tu propio número, que es a lo que entraste. */}
      {listo && miSaldo ? (
        <div className="mt-5">
          <MiSaldo saldo={miSaldo} liquidacion={juntada.liquidacion} />
        </div>
      ) : null}

      <div className="mt-7 flex flex-col gap-7">
        <section>
          <Titulo>Qué se gastó</Titulo>
          <ListaGastos
            juntadaId={juntada.id}
            slug={juntada.slug}
            gastos={juntada.gastos}
            participantes={juntada.participantes}
            identidadId={identidadId}
          />
        </section>

        <section>
          <Titulo>Quién puso qué</Titulo>
          <Saldos saldos={juntada.saldos} />
        </section>

        <section>
          <Titulo>Quién le paga a quién</Titulo>
          <div className="flex flex-col gap-2">
            <Liquidacion
              juntadaId={juntada.id}
              slug={juntada.slug}
              transferencias={juntada.liquidacion}
              participantes={juntada.participantes}
              hayGastos={juntada.gastos.length > 0}
            />
            {/* Va acá y no en un menú aparte: es donde se entiende para qué sirve. */}
            {listo && yo ? (
              <MiAlias juntadaId={juntada.id} slug={juntada.slug} yo={yo} />
            ) : null}
          </div>
        </section>

        <PagosRegistrados
          juntadaId={juntada.id}
          slug={juntada.slug}
          pagos={juntada.pagos}
          participantes={juntada.participantes}
        />

        <BotonCompartir mensaje={mensaje} />

        <AgregarParticipante juntadaId={juntada.id} slug={juntada.slug} />
      </div>

      {/* Botón fijo: cargar un gasto tiene que estar siempre a un toque del pulgar. */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-linear-to-t from-stone-100 via-stone-100 to-transparent px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={() => setGastoAbierto(true)}
          className="mx-auto block w-full max-w-md rounded-2xl bg-stone-900 px-6 py-4 text-lg font-semibold text-white shadow-lg transition active:scale-[0.98]"
        >
          + Gasto
        </button>
      </div>

      {gastoAbierto ? (
        <FormularioGasto
          juntadaId={juntada.id}
          slug={juntada.slug}
          participantes={juntada.participantes}
          identidadId={identidadId}
          onCerrar={() => setGastoAbierto(false)}
        />
      ) : null}

      {selectorAbierto ? (
        <SelectorIdentidad
          participantes={juntada.participantes}
          identidadId={identidadId}
          onElegir={elegir}
          onCerrar={() => setSelectorAbierto(false)}
        />
      ) : null}
    </main>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 px-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">
      {children}
    </h2>
  );
}
