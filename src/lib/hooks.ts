"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Participante } from "./dominio/tipos";

const clave = (slug: string) => `juntada:${slug}:participante`;

/**
 * La identidad del que está mirando: un id de participante en localStorage.
 * Sin cookies, sin sesión, sin backend de auth (P1).
 *
 * `listo` arranca en false y recién pasa a true después del primer efecto: en el servidor
 * no existe localStorage, así que si renderizáramos la identidad en el primer paint
 * tendríamos un mismatch de hidratación en cada carga.
 */
export function useIdentidad(slug: string, participantes: Participante[]) {
  const [id, setId] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  // Depender del array haría correr el efecto en cada render. La lista de ids sí es estable.
  const idsDisponibles = participantes.map((p) => p.id).join(",");

  useEffect(() => {
    let guardado: string | null = null;
    try {
      guardado = localStorage.getItem(clave(slug));
    } catch {
      // Navegador con storage bloqueado: se comporta como si fuera la primera visita.
    }
    // Si el participante guardado ya no existe (lo borraron, o es otra juntada), se vuelve a preguntar.
    setId(guardado && idsDisponibles.split(",").includes(guardado) ? guardado : null);
    setListo(true);
  }, [slug, idsDisponibles]);

  const elegir = useCallback(
    (nuevo: string) => {
      try {
        localStorage.setItem(clave(slug), nuevo);
      } catch {
        // Si no se puede guardar, al menos vale para esta sesión.
      }
      setId(nuevo);
    },
    [slug],
  );

  return { id, listo, elegir };
}

/**
 * Vuelve a pedir el estado al servidor cuando la pestaña recupera el foco.
 *
 * Es el caso real de dos personas cargando gastos a la vez: mirás el celular, lo guardás
 * en el bolsillo, lo volvés a sacar y ya está lo que cargó el otro. Sin polling, sin
 * websockets, sin nada corriendo de fondo.
 */
export function useRefrescoAlVolver() {
  const router = useRouter();

  useEffect(() => {
    const refrescar = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    window.addEventListener("focus", refrescar);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      window.removeEventListener("focus", refrescar);
      document.removeEventListener("visibilitychange", refrescar);
    };
  }, [router]);
}
