import { describe, expect, it } from "vitest";
import { repartirIgual } from "./reparto";
import { calcularSaldos } from "./saldos";
import { liquidacionMinima } from "./liquidacion";
import type { Gasto, Pago, Participante, Saldo, Transferencia } from "./tipos";

/**
 * Tests del motor de cálculo: donde un error se traduce en amigos discutiendo por plata.
 *
 * Los dos primeros son el redondeo (RN-02) y la invariante de saldos en cero (RN-03).
 * Cada uno mete un barrido de casos adentro para valer más que un ejemplo.
 *
 * Los que siguen cubren lo que la invariante NO ve. Σ(saldos) = 0 se cumple incluso cuando
 * las cuentas quedaron al revés, así que sola no alcanza como red de seguridad: el test del
 * pago duplicado es exactamente ese caso.
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

describe("liquidación mínima (RN-06)", () => {
  /**
   * Las propiedades que RN-06 le exige a CUALQUIER liquidación, sea cual sea la juntada.
   *
   * El test de la invariante de arriba verifica que la suma cierre; esto verifica que la
   * lista de transferencias sea además usable: sin transferencias a uno mismo, sin montos
   * en cero, sin molestar a nadie que ya está a mano, y cerrando exacto por persona.
   */
  const verificarPropiedades = (saldos: Saldo[], liquidacion: Transferencia[]) => {
    const saldoPorId = new Map(saldos.map((s) => [s.participanteId, s.saldoCentavos]));
    const neto = new Map<string, number>();

    for (const t of liquidacion) {
      expect(t.deId, "nadie se transfiere a sí mismo").not.toBe(t.aId);
      expect(t.montoCentavos, "ninguna transferencia de cero").toBeGreaterThan(0);

      // RN-06: nunca una transferencia que toque a alguien que ya está saldado.
      expect(saldoPorId.get(t.deId)!, `${t.deNombre} no debe nada`).toBeLessThan(0);
      expect(saldoPorId.get(t.aId)!, `a ${t.aNombre} no le deben nada`).toBeGreaterThan(0);

      neto.set(t.deId, (neto.get(t.deId) ?? 0) - t.montoCentavos);
      neto.set(t.aId, (neto.get(t.aId) ?? 0) + t.montoCentavos);
    }

    // Lo que cada uno manda o recibe iguala EXACTAMENTE su saldo. Ni un centavo suelto.
    for (const s of saldos) {
      expect(neto.get(s.participanteId) ?? 0, `neto de ${s.nombre}`).toBe(s.saldoCentavos);
    }

    const enJuego = saldos.filter((s) => s.saldoCentavos !== 0).length;
    if (enJuego > 0) {
      expect(liquidacion.length, "a lo sumo n−1 transferencias").toBeLessThanOrEqual(enJuego - 1);
    }
  };

  it("no genera transferencias hacia nadie que ya esté saldado", () => {
    // Caro está justo: puso exactamente lo que le toca, así que no tiene que aparecer en
    // la liquidación. Total $13.500 entre tres son $4.500 cada uno, y Caro puso $4.500.
    const [ana, beto, caro] = gente(3);
    const gastos: Gasto[] = [
      {
        id: "g1",
        descripcion: "Carne",
        montoCentavos: 900_000,
        pagadorId: ana.id,
        repartos: repartirIgual(900_000, [ana, beto, caro], ana.id),
      },
      {
        id: "g2",
        descripcion: "Bebida",
        montoCentavos: 450_000,
        pagadorId: caro.id,
        repartos: repartirIgual(450_000, [ana, beto, caro], caro.id),
      },
    ];

    const saldos = calcularSaldos([ana, beto, caro], gastos, []);
    expect(saldos.map((s) => s.saldoCentavos)).toEqual([450_000, -450_000, 0]);

    const liquidacion = liquidacionMinima(saldos);
    verificarPropiedades(saldos, liquidacion);
    expect(liquidacion.every((t) => t.deId !== caro.id && t.aId !== caro.id)).toBe(true);
  });

  it("da la misma lista aunque los saldos lleguen en otro orden", () => {
    // Dos personas mirando la pantalla al mismo tiempo tienen que ver exactamente lo mismo,
    // así que el resultado no puede depender del orden en que la base devolvió las filas.
    const grupo = gente(6);
    const gastos: Gasto[] = grupo.map((p, i) => ({
      id: `g${i}`,
      descripcion: `Gasto ${i}`,
      montoCentavos: 100_000 * (i + 1) + 7,
      pagadorId: p.id,
      repartos: repartirIgual(100_000 * (i + 1) + 7, grupo, p.id),
    }));

    const saldos = calcularSaldos(grupo, gastos, []);
    const esperada = liquidacionMinima(saldos);

    const rnd = random(99);
    for (let intento = 0; intento < 20; intento++) {
      const mezclados = [...saldos].sort(() => rnd() - 0.5);
      expect(liquidacionMinima(mezclados)).toEqual(esperada);
    }
  });

  it("cumple las propiedades en juntadas armadas al azar", () => {
    for (let semilla = 1; semilla <= 200; semilla++) {
      const rnd = random(semilla + 5000);
      const n = 2 + Math.floor(rnd() * 9);
      const grupo = gente(n);

      const gastos: Gasto[] = [];
      for (let g = 0; g < 1 + Math.floor(rnd() * 10); g++) {
        const incluidos = grupo.filter(() => rnd() > 0.3);
        if (incluidos.length === 0) incluidos.push(grupo[Math.floor(rnd() * n)]);
        const monto = 1 + Math.floor(rnd() * 5_000_000);
        const pagador = grupo[Math.floor(rnd() * n)];
        gastos.push({
          id: `g${g}`,
          descripcion: `Gasto ${g}`,
          montoCentavos: monto,
          pagadorId: pagador.id,
          repartos: repartirIgual(monto, incluidos, pagador.id),
        });
      }

      const saldos = calcularSaldos(grupo, gastos, []);
      verificarPropiedades(saldos, liquidacionMinima(saldos));
    }
  });
});

describe("pagos registrados", () => {
  /** Ana pone $10.000 de carne y comen los tres. El escenario del checklist. */
  const escenario = () => {
    const [ana, beto, caro] = gente(3);
    const participantes = [ana, beto, caro];
    const gastos: Gasto[] = [
      {
        id: "g1",
        descripcion: "Carne",
        montoCentavos: 1_000_000,
        pagadorId: ana.id,
        repartos: repartirIgual(1_000_000, participantes, ana.id),
      },
    ];
    return { ana, beto, caro, participantes, gastos };
  };

  /**
   * ⚠ El error más probable en uso real, y el que ningún test de la invariante puede ver.
   *
   * Beto transfiere y toca "Saldado". Ana ve que le llegó la plata y lo toca también. Dos
   * pagos iguales. Los saldos NO se descuadran —la suma sigue dando cero— pero se dan
   * vuelta: la app pasa a pedirle a Ana que devuelva todo lo que puso.
   *
   * Este test fija ese comportamiento del motor, que es correcto: dos pagos son dos pagos.
   * Quien tiene que evitar que se registre el segundo es `marcarSaldado` en `acciones.ts`,
   * porque es el único que sabe que fue un doble toque y no una transferencia de verdad.
   */
  it("un pago registrado dos veces da vuelta los saldos sin descuadrarlos", () => {
    const { ana, beto, caro, participantes, gastos } = escenario();

    const antes = calcularSaldos(participantes, gastos, []);
    expect(antes.map((s) => s.saldoCentavos)).toEqual([666_666, -333_333, -333_333]);

    const liquidacion = liquidacionMinima(antes);
    const duplicados: Pago[] = [...liquidacion, ...liquidacion].map((t, i) => ({
      id: `pago${i}`,
      deId: t.deId,
      aId: t.aId,
      montoCentavos: t.montoCentavos,
    }));

    const despues = calcularSaldos(participantes, gastos, duplicados);

    // La invariante aguanta: por eso el error es invisible para el test de la suma.
    expect(despues.reduce((acc, s) => acc + s.saldoCentavos, 0)).toBe(0);

    // Y sin embargo Ana, que puso toda la plata, ahora figura debiéndola.
    expect(despues.map((s) => s.saldoCentavos)).toEqual([-666_666, 333_333, 333_333]);
    expect(liquidacionMinima(despues)).toEqual([
      { deId: ana.id, deNombre: ana.nombre, aId: beto.id, aNombre: beto.nombre, montoCentavos: 333_333 },
      { deId: ana.id, deNombre: ana.nombre, aId: caro.id, aNombre: caro.nombre, montoCentavos: 333_333 },
    ]);
  });

  it("un pago parcial deja el resto pendiente", () => {
    const { ana, beto, participantes, gastos } = escenario();
    const parcial: Pago[] = [{ id: "p1", deId: beto.id, aId: ana.id, montoCentavos: 100_000 }];

    const saldos = calcularSaldos(participantes, gastos, parcial);
    expect(saldos[1].saldoCentavos).toBe(-233_333); // a Beto le quedan $2.333,33
    expect(saldos.reduce((acc, s) => acc + s.saldoCentavos, 0)).toBe(0);

    const pendiente = liquidacionMinima(saldos).find((t) => t.deId === beto.id);
    expect(pendiente?.montoCentavos).toBe(233_333);
  });

  it("un pago de más invierte solo a los dos que lo hicieron", () => {
    const { ana, beto, participantes, gastos } = escenario();
    const deMas: Pago[] = [{ id: "p1", deId: beto.id, aId: ana.id, montoCentavos: 900_000 }];

    const saldos = calcularSaldos(participantes, gastos, deMas);
    expect(saldos.reduce((acc, s) => acc + s.saldoCentavos, 0)).toBe(0);
    expect(saldos[1].saldoCentavos).toBeGreaterThan(0); // ahora a Beto le deben
    expect(saldos[2].saldoCentavos).toBe(-333_333); // Caro no se enteró de nada
  });

  it("la liquidación salda a todos aunque ya haya pagos sueltos cargados", () => {
    // Barrido con pagos ARBITRARIOS, no derivados de la liquidación: parciales, de más y
    // repetidos. Es el estado real de una juntada donde la gente fue transfiriendo a mano.
    for (let semilla = 1; semilla <= 200; semilla++) {
      const rnd = random(semilla + 9000);
      const n = 2 + Math.floor(rnd() * 7);
      const grupo = gente(n);

      const gastos: Gasto[] = [];
      for (let g = 0; g < 1 + Math.floor(rnd() * 8); g++) {
        const incluidos = grupo.filter(() => rnd() > 0.3);
        if (incluidos.length === 0) incluidos.push(grupo[Math.floor(rnd() * n)]);
        const monto = 1 + Math.floor(rnd() * 2_000_000);
        const pagador = grupo[Math.floor(rnd() * n)];
        gastos.push({
          id: `g${g}`,
          descripcion: `Gasto ${g}`,
          montoCentavos: monto,
          pagadorId: pagador.id,
          repartos: repartirIgual(monto, incluidos, pagador.id),
        });
      }

      const sueltos: Pago[] = [];
      for (let p = 0; p < Math.floor(rnd() * 6); p++) {
        const de = Math.floor(rnd() * n);
        const a = (de + 1 + Math.floor(rnd() * (n - 1))) % n; // nunca a sí mismo
        sueltos.push({
          id: `p${p}`,
          deId: grupo[de].id,
          aId: grupo[a].id,
          montoCentavos: 1 + Math.floor(rnd() * 1_500_000),
        });
      }

      const saldos = calcularSaldos(grupo, gastos, sueltos);
      expect(saldos.reduce((acc, s) => acc + s.saldoCentavos, 0)).toBe(0);

      // Aplicar la liquidación encima tiene que dejar a TODOS en cero, no solo a la suma.
      const liquidacion = liquidacionMinima(saldos);
      const todos = [
        ...sueltos,
        ...liquidacion.map((t, i) => ({
          id: `liq${i}`,
          deId: t.deId,
          aId: t.aId,
          montoCentavos: t.montoCentavos,
        })),
      ];
      const finales = calcularSaldos(grupo, gastos, todos);
      expect(finales.every((s) => s.saldoCentavos === 0)).toBe(true);
      expect(liquidacionMinima(finales)).toEqual([]);
    }
  });
});
