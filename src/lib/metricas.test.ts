import { describe, expect, it } from "vitest";
import { generarSlug } from "./slug";
import { redactarUrl } from "./metricas";

/**
 * Tests de la redacción que corre antes de mandar una visita a las métricas.
 *
 * Es una función chica pero es la única del paquete de métricas donde un error tiene
 * consecuencias reales: si deja pasar un slug, la credencial de acceso a esa juntada queda
 * escrita en un panel de terceros y no hay forma de retirarla de ahí.
 *
 * Por eso los tests están escritos al revés de lo habitual: en vez de comprobar que la
 * salida sea la esperada, comprueban sobre todo que el slug NO esté en la salida, para
 * cualquier forma de URL que se le pueda pasar.
 */

const BASE = "https://arreglamo.vercel.app";

describe("redactarUrl", () => {
  it("enmascara el slug de la juntada", () => {
    expect(redactarUrl(`${BASE}/j/asado-del-sabado-k7m2xq4p`)).toBe(`${BASE}/j/[slug]`);
    expect(redactarUrl(`${BASE}/j/cumple-de-nico-9x2plq8w`)).toBe(`${BASE}/j/[slug]`);
  });

  it("deja pasar las rutas que no esconden nada", () => {
    expect(redactarUrl(`${BASE}/`)).toBe(`${BASE}/`);
    expect(redactarUrl(BASE)).toBe(`${BASE}/`);
  });

  it("tira la query y el hash", () => {
    // Hoy no hay nada sensible ahí, y esto es lo que hace que siga siendo cierto mañana.
    expect(redactarUrl(`${BASE}/j/asado-k7m2xq4p?v=1730000000000`)).toBe(`${BASE}/j/[slug]`);
    expect(redactarUrl(`${BASE}/j/asado-k7m2xq4p#saldos`)).toBe(`${BASE}/j/[slug]`);
    expect(redactarUrl(`${BASE}/?ref=whatsapp`)).toBe(`${BASE}/`);
  });

  it("no deja escapar credenciales metidas en la URL", () => {
    const redactada = redactarUrl(`https://usuario:secreto@arreglamo.vercel.app/j/asado-k7m2xq4p`);
    expect(redactada).not.toContain("secreto");
    expect(redactada).not.toContain("usuario");
  });

  it("descarta el evento en vez de mandar algo que no pudo redactar", () => {
    // Falla cerrado: perder una visita del contador no cuesta nada, filtrar un slug sí.
    expect(redactarUrl("")).toBeNull();
    expect(redactarUrl("no es una url")).toBeNull();
    expect(redactarUrl("/j/asado-k7m2xq4p")).toBeNull(); // relativa: no parsea sola
    expect(redactarUrl("javascript:alert(1)")).toBeNull();
    expect(redactarUrl("data:text/html,hola")).toBeNull();
  });

  it("nunca deja salir un slug, sea cual sea la forma de la URL", () => {
    /**
     * El test que importa. Se generan slugs de verdad con `generarSlug` —el mismo que usa la
     * app— y se los mete en toda variante de URL que se me ocurre que puede llegar al
     * evento: con query, con hash, con barra final, con subrutas, con mayúsculas, con el
     * slug repetido más abajo en el path.
     *
     * Para cada una: o la salida no contiene el slug, o no hay salida.
     */
    const nombres = [
      "Asado del sábado",
      "Cumple de Nico",
      "Finde en la costa",
      "Regalo para mamá",
      "a",
      "Juntada 2026",
    ];

    let revisadas = 0;
    for (const nombre of nombres) {
      for (let i = 0; i < 25; i++) {
        const slug = generarSlug(nombre);

        const variantes = [
          `${BASE}/j/${slug}`,
          `${BASE}/j/${slug}/`,
          `${BASE}/j/${slug}?v=1730000000000`,
          `${BASE}/j/${slug}#quien-le-paga-a-quien`,
          `${BASE}/j/${slug}?a=1&b=2#c`,
          `${BASE}/j/${slug}/gastos`,
          `${BASE}/j/${slug}/gastos/nuevo?volver=/j/${slug}`,
          `${BASE}/api/og/${slug}?v=1730000000000`,
          `http://arreglamo.vercel.app/j/${slug}`,
          `https://usuario:clave@arreglamo.vercel.app/j/${slug}`,
        ];

        for (const cruda of variantes) {
          const redactada = redactarUrl(cruda);
          if (redactada !== null) {
            expect(redactada, `se escapó el slug desde ${cruda}`).not.toContain(slug);
          }
          revisadas++;
        }
      }
    }

    expect(revisadas).toBe(nombres.length * 25 * 10);
  });

  it("enmascara también la imagen de preview, que lleva el slug en la ruta", () => {
    // `/api/og/<slug>` es la otra ruta con el slug adentro. No la navega una persona —la
    // pide el crawler de WhatsApp— pero se enmascara igual, así no hay que razonar sobre
    // si algún día puede llegar a emitir un evento.
    expect(redactarUrl(`${BASE}/api/og/asado-k7m2xq4p?v=1`)).toBe(`${BASE}/api/og/[slug]`);
    expect(redactarUrl(`${BASE}/api/og/cumple-de-nico-9x2plq8w`)).toBe(`${BASE}/api/og/[slug]`);
  });
});
