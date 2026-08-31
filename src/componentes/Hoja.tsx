"use client";

import { useEffect } from "react";

/**
 * Hoja que sube desde abajo. Todo lo interactivo entra por acá.
 *
 * Sube desde abajo y no desde el centro porque la pantalla se usa con una mano: los
 * controles quedan cerca del pulgar, no arriba de todo.
 */
export function Hoja({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alTeclear);
    // Bloquea el scroll del fondo mientras la hoja está abierta.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 bg-stone-900/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="relative max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-stone-100 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-300" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{titulo}</h2>
          <button
            onClick={onCerrar}
            className="-mr-2 rounded-full px-3 py-1 text-stone-500 active:bg-stone-200"
          >
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
