import { ImageResponse } from "next/og";
import { getResumenParaPreview } from "@/lib/consultas";
import { formatearPesos } from "@/lib/dinero";

/**
 * La imagen del preview de WhatsApp.
 *
 * Va como route handler propio y no como el `opengraph-image.tsx` por convención de Next:
 * ese hashea la URL en tiempo de build, así que con datos que cambian el preview se
 * quedaría congelado en el estado del deploy. Acá la URL la controlamos nosotros y lleva
 * `?v=<actualizada_en>`, así que cada cambio de estado es una URL nueva.
 *
 * Como el contenido de un `?v=` dado no cambia nunca, se puede cachear para siempre.
 * Eso es lo que mantiene el unfurl abajo del segundo que pide RNF-04.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const resumen = await getResumenParaPreview(slug);

  if (!resumen) {
    return new Response("Esta juntada no existe", { status: 404 });
  }

  const personas = `${resumen.cantidadPersonas} ${
    resumen.cantidadPersonas === 1 ? "persona" : "personas"
  }`;

  // Satori no aplica `-webkit-line-clamp` como un navegador, así que el largo se controla
  // a mano: un nombre de 80 caracteres (el máximo que deja cargar) empujaría el total
  // fuera de la imagen, que es justo el dato que tiene que verse.
  const nombre =
    resumen.nombre.length > 70 ? `${resumen.nombre.slice(0, 69).trimEnd()}…` : resumen.nombre;
  const tamañoNombre = nombre.length <= 28 ? 72 : nombre.length <= 48 ? 58 : 46;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#1c1917",
          color: "#fafaf9",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 30, color: "#a8a29e", letterSpacing: 2 }}>ARREGLAMO</div>
          <div style={{ fontSize: tamañoNombre, fontWeight: 700, lineHeight: 1.15 }}>
            {nombre}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 32, color: "#a8a29e" }}>
            {resumen.totalCentavos === 0 ? "Todavía sin gastos" : "Van gastados"}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 28 }}>
            <div style={{ fontSize: 128, fontWeight: 800, lineHeight: 1 }}>
              {formatearPesos(resumen.totalCentavos)}
            </div>
            <div style={{ fontSize: 36, color: "#a8a29e", paddingBottom: 12 }}>{personas}</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // Inmutable para este ?v=. El próximo cambio de estado pide otra URL.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
