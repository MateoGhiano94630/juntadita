import { ImageResponse } from "next/og";
import { getResumenParaPreview } from "@/lib/consultas";
import { formatearPesos } from "@/lib/dinero";
import { baseUrl } from "@/lib/url";

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
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const resumen = await getResumenParaPreview(slug);

  if (!resumen) {
    return new Response("Esta juntada no existe", { status: 404 });
  }

  /**
   * La imagen depende SOLO del estado de la juntada, y el `?v=` que la identifica sale de
   * `actualizada_en`. Si llega cualquier otro valor se manda al canónico en vez de renderizar.
   *
   * Sin esto, pedir `?v=` con un número al azar fuerza un render nuevo en cada request: es un
   * endpoint público y renderizar la imagen es lo más caro que hace la app (RNF-41). Con esto,
   * lo único que cuesta una URL inventada es la consulta del resumen.
   *
   * El camino real no pasa por acá: el `og:image` que emite la página siempre trae el valor
   * actual. Solo lo ve un link viejo, y para ese la redirección es justo lo que corresponde.
   */
  const actual = String(resumen.actualizadaEn.getTime());
  if (new URL(request.url).searchParams.get("v") !== actual) {
    // Se arma desde `baseUrl()` y no desde `request.url` para no reenviar a un host interno.
    return Response.redirect(`${baseUrl()}/api/og/${encodeURIComponent(slug)}?v=${actual}`, 307);
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
          <div style={{ fontSize: 30, color: "#a8a29e", letterSpacing: 2 }}>JUNTADA</div>
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
