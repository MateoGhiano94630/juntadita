import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PantallaJuntada } from "@/componentes/PantallaJuntada";
import { getJuntadaPorSlug } from "@/lib/consultas";
import { formatearPesos } from "@/lib/dinero";
import { baseUrl, urlJuntada } from "@/lib/url";

/**
 * Siempre fresco. El preview de WhatsApp tiene que mostrar el estado real (A2), así que
 * esta página no se puede servir desde una caché estática.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  // Se pide la juntada completa y no el resumen liviano: el render de abajo la va a pedir
  // igual, y `getJuntadaPorSlug` está cacheada por request, así que esto no cuesta ninguna
  // consulta extra. El resumen liviano es para la imagen, que se sirve en otra request.
  const juntada = await getJuntadaPorSlug(slug);

  if (!juntada) {
    return { title: "Esta juntada no existe" };
  }

  const cantidad = juntada.participantes.length;
  const personas = `${cantidad} ${cantidad === 1 ? "persona" : "personas"}`;
  const descripcion =
    juntada.totalCentavos === 0
      ? `${personas} · todavía sin gastos. Entrá y cargá el tuyo.`
      : `${personas} · ${formatearPesos(juntada.totalCentavos)} gastados. Entrá y cargá el tuyo.`;

  // El ?v= es el cache-buster: WhatsApp cachea la imagen por URL, así que cada cambio de
  // estado tiene que producir una URL distinta o el preview se queda congelado. La ruta de
  // la imagen redirige a este mismo valor si le piden cualquier otro.
  const imagen = `${baseUrl()}/api/og/${slug}?v=${juntada.actualizadaEn.getTime()}`;

  return {
    title: juntada.nombre,
    description: descripcion,
    openGraph: {
      type: "website",
      siteName: "Arreglamo",
      locale: "es_AR",
      url: urlJuntada(slug),
      title: juntada.nombre,
      description: descripcion,
      images: [{ url: imagen, width: 1200, height: 630, alt: juntada.nombre }],
    },
    twitter: {
      card: "summary_large_image",
      title: juntada.nombre,
      description: descripcion,
      images: [imagen],
    },
  };
}

export default async function PaginaJuntada({ params }: Props) {
  const { slug } = await params;
  const juntada = await getJuntadaPorSlug(slug);

  if (!juntada) notFound();

  return <PantallaJuntada juntada={juntada} url={urlJuntada(slug)} />;
}
