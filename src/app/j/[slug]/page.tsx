import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PantallaJuntada } from "@/componentes/PantallaJuntada";
import { getJuntadaPorSlug, getResumenParaPreview } from "@/lib/consultas";
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
  const resumen = await getResumenParaPreview(slug);

  if (!resumen) {
    return { title: "Esta juntada no existe" };
  }

  const personas = `${resumen.cantidadPersonas} ${
    resumen.cantidadPersonas === 1 ? "persona" : "personas"
  }`;
  const descripcion =
    resumen.totalCentavos === 0
      ? `${personas} · todavía sin gastos. Entrá y cargá el tuyo.`
      : `${personas} · ${formatearPesos(resumen.totalCentavos)} gastados. Entrá y cargá el tuyo.`;

  // El ?v= es el cache-buster: WhatsApp cachea la imagen por URL, así que cada cambio de
  // estado tiene que producir una URL distinta o el preview se queda congelado.
  const imagen = `${baseUrl()}/api/og/${slug}?v=${resumen.actualizadaEn.getTime()}`;

  return {
    title: resumen.nombre,
    description: descripcion,
    openGraph: {
      type: "website",
      siteName: "Juntada",
      locale: "es_AR",
      url: urlJuntada(slug),
      title: resumen.nombre,
      description: descripcion,
      images: [{ url: imagen, width: 1200, height: 630, alt: resumen.nombre }],
    },
    twitter: {
      card: "summary_large_image",
      title: resumen.nombre,
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
