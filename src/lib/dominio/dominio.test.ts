import { describe, expect, it } from "vitest";
import { repartirIgual } from "./reparto";
import { calcularSaldos } from "./saldos";
import { liquidacionMinima } from "./liquidacion";
import type { Gasto, Pago, Participante } from "./tipos";

/**
 * Los dos únicos tests del proyecto, por pedido explícito.
 *
 * Son los dos donde un error se traduce en amigos discutiendo por plata:
 * el redondeo (RN-02) y la invariante de saldos en cero (RN-03).
 * Cada uno mete un barrido de casos adentro para que valgan más que un ejemplo.
 */

const gente = (n: number): Participante[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nombre: `Persona ${i}`,
    orden: i,
  }));

const sumaDe = (xs: { montoCentavos: number }[]) =>
  xs.reduce((acc, x) => acc + x.montoCentavos, 0);

const parteDe = (repartos: { participanteId: string; montoCentavos: number }[], id: string) =>
  repartos.find((r) => r.participanteId === id)!.montoCentavos;

/** PRNG con semilla fija: el barrido aleatorio tiene que ser reproducible. */
function random(semilla: number) {
  let a = semilla;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("motor de dominio", () => {
  it("el reparto de un gasto suma exactamente el monto, siempre", () => {
    // El caso del checklist de PROBAR.md: $10.000 entre 3 no divide exacto.
    // 1.000.000 centavos / 3 = 333.333,33... El centavo que sobra va al que pagó.
    const tres = gente(3);
    const diezMil = repartirIgual(1_000_000, tres, "p1");

    expect(sumaDe(diezMil)).toBe(1_000_000);
    expect(parteDe(diezMil, "p1")).toBe(333_334); // p1 pagó, se come el centavo
    expect(parteDe(diezMil, "p0")).toBe(333_333);
    expect(parteDe(diezMil, "p2")).toBe(333_333);

    // Con residuo > 1 la cola sigue por orden de incorporación después del pagador.
    // 10 centavos entre 4 → base 2, sobran 2. Cola: p2 (pagador), p0, p1, p3.
    const diezCentavos = repartirIgual(10, gente(4), "p2");
    expect(sumaDe(diezCentavos)).toBe(10);
    expect(diezCentavos.map((r) => r.montoCentavos)).toEqual([3, 2, 3, 2]);

    // Barrido: ninguna combinación de monto × cantidad de gente puede perder un centavo.
    const montos = [1, 2, 3, 7, 99, 100, 101, 4_999, 123_457, 999_999, 1_000_000, 20_000_000];
    for (let n = 1; n <= 12; n++) {
      const participantes = gente(n);
      for (const monto of montos) {
        for (const pagador of participantes) {
          const partes = repartirIgual(monto, participantes, pagador.id);

          // 1. No se pierde ni se inventa plata.
          expect(sumaDe(partes)).toBe(monto);

          // 2. Nadie paga más de un centavo de diferencia respecto de otro.
          const valores = partes.map((r) => r.montoCentavos);
          expect(Math.max(...valores) - Math.min(...valores)).toBeLessThanOrEqual(1);

          // 3. Todas las partes son enteros no negativos.
          expect(valores.every((v) => Number.isInteger(v) && v >= 0)).toBe(true);

          // 4. Determinístico: recalcular da idénticamente lo mismo.
          expect(repartirIgual(monto, participantes, pagador.id)).toEqual(partes);
        }
      }
    }

    // Y rechaza lo que no tiene sentido, en vez de devolver basura.
    expect(() => repartirIgual(0, tres, "p0")).toThrow();
    expect(() => repartirIgual(-100, tres, "p0")).toThrow();
    expect(() => repartirIgual(100.5, tres, "p0")).toThrow();
    expect(() => repartirIgual(100, [], "p0")).toThrow();
  });

  it("la suma de todos los saldos da exactamente cero", () => {
    // Escenario a mano, con números verificables a ojo.
    const [ana, beto, caro] = gente(3);
    const participantes = [ana, beto, caro];

    const gastos: Gasto[] = [
      {
        // Ana pone $10.000 de carne, comen los tres.
        id: "g1",
        descripcion: "Carne",
        montoCentavos: 1_000_000,
        pagadorId: ana.id,
        repartos: repartirIgual(1_000_000, participantes, ana.id),
      },
      {
        // Beto pone $3.000 de bebida, pero Caro no toma.
        id: "g2",
        descripcion: "Bebida",
        montoCentavos: 300_000,
        pagadorId: beto.id,
        repartos: repartirIgual(300_000, [ana, beto], beto.id),
      },
    ];

    const sinPagos = calcularSaldos(participantes, gastos, []);
    expect(sinPagos.reduce((acc, s) => acc + s.saldoCentavos, 0)).toBe(0);

    // Ana puso 1.000.000, le corresponde 333.334 (carne) + 150.000 (bebida) = 483.334
    expect(sinPagos[0]).toMatchObject({ puestoCentavos: 1_000_000, correspondeCentavos: 483_334 });
    expect(sinPagos[0].saldoCentavos).toBe(516_666);
    // Beto puso 300.000, le corresponde 333.333 + 150.000 = 483.333
    expect(sinPagos[1].saldoCentavos).toBe(-183_333);
    // Caro no puso nada y le corresponde solo la carne.
    expect(sinPagos[2].saldoCentavos).toBe(-333_333);

    // Al marcar toda la liquidación como saldada, todos quedan en cero exacto.
    const pagos: Pago[] = liquidacionMinima(sinPagos).map((t, i) => ({
      id: `pago${i}`,
      deId: t.deId,
      aId: t.aId,
      montoCentavos: t.montoCentavos,
    }));
    const despues = calcularSaldos(participantes, gastos, pagos);
    expect(despues.map((s) => s.saldoCentavos)).toEqual([0, 0, 0]);
    expect(liquidacionMinima(despues)).toEqual([]);

    // Barrido pseudoaleatorio: juntadas armadas al azar, con semilla fija.
    for (let semilla = 1; semilla <= 200; semilla++) {
      const rnd = random(semilla);
      const n = 2 + Math.floor(rnd() * 9); // entre 2 y 10 personas
      const grupo = gente(n);

      const gastosAzar: Gasto[] = [];
      const cantidadGastos = 1 + Math.floor(rnd() * 12);
      for (let g = 0; g < cantidadGastos; g++) {
        // Subconjunto no vacío: no siempre participan todos.
        const incluidos = grupo.filter(() => rnd() > 0.35);
        if (incluidos.length === 0) incluidos.push(grupo[Math.floor(rnd() * n)]);
        const monto = 1 + Math.floor(rnd() * 5_000_000);
        const pagador = grupo[Math.floor(rnd() * n)];
        gastosAzar.push({
          id: `g${g}`,
          descripcion: `Gasto ${g}`,
          montoCentavos: monto,
          pagadorId: pagador.id,
          repartos: repartirIgual(monto, incluidos, pagador.id),
        });
      }

      const saldos = calcularSaldos(grupo, gastosAzar, []);
      expect(saldos.reduce((acc, s) => acc + s.saldoCentavos, 0)).toBe(0);

      // Y sigue cerrando en cero después de saldar toda la liquidación.
      const liquidacion = liquidacionMinima(saldos);
      const pagosAzar: Pago[] = liquidacion.map((t, i) => ({
        id: `pago${i}`,
        deId: t.deId,
        aId: t.aId,
        montoCentavos: t.montoCentavos,
      }));
      const saldados = calcularSaldos(grupo, gastosAzar, pagosAzar);
      expect(saldados.reduce((acc, s) => acc + s.saldoCentavos, 0)).toBe(0);
      // La liquidación deja a todo el mundo en cero, no solo la suma.
      expect(saldados.every((s) => s.saldoCentavos === 0)).toBe(true);
      // Nunca más de n−1 transferencias.
      expect(liquidacion.length).toBeLessThanOrEqual(n - 1);
    }
  });
});
