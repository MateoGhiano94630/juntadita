import { formatearPesos } from "./dinero";
import type { Transferencia } from "./dominio/tipos";

/**
 * Arma el texto que se pega en el grupo.
 *
 * El requisito real: tiene que entenderse ENTERO sin abrir el link (P2, RNF-24).
 * Mucha gente del grupo nunca va a tocar el link, y la liquidación les tiene que llegar
 * igual. Por eso el mensaje lleva los montos, no un "entrá a ver cuánto debés".
 *
 * Usa el markdown de WhatsApp: `*negrita*`.
 */
export function armarMensaje({
  nombre,
  totalCentavos,
  cantidadPersonas,
  transferencias,
  url,
}: {
  nombre: string;
  totalCentavos: number;
  cantidadPersonas: number;
  transferencias: Transferencia[];
  url: string;
}): string {
  const personas = `${cantidadPersonas} ${cantidadPersonas === 1 ? "persona" : "personas"}`;

  const lineas = [`*${nombre}*`];

  if (totalCentavos === 0) {
    lineas.push(`Todavía no hay gastos cargados · ${personas}`);
    lineas.push("", "Cargá tus gastos acá:", url);
    return lineas.join("\n");
  }

  lineas.push(`Total: ${formatearPesos(totalCentavos)} · ${personas}`);
  lineas.push("");

  if (transferencias.length === 0) {
    lineas.push("Ya está todo saldado, no queda nada por transferir.");
  } else {
    lineas.push("Quién le paga a quién:");
    for (const t of transferencias) {
      lineas.push(`• ${t.deNombre} → ${t.aNombre}: ${formatearPesos(t.montoCentavos)}`);
    }
  }

  lineas.push("", "Cargá tus gastos acá:", url);
  return lineas.join("\n");
}
