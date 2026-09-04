import { describe, expect, it } from "vitest";
import { formatearPesos, parsearPesos } from "../dinero";
import { liquidacionMinima } from "./liquidacion";
import { repartirIgual } from "./reparto";
import { calcularSaldos, totalGastado } from "./saldos";
import type { Gasto, Pago, Participante, Saldo } from "./tipos";

/**
 * Barrido exhaustivo de divisiones de gastos.
 *
 * `dominio.test.ts` prueba las invariantes con muestreo: algunos montos elegidos a mano y
 * juntadas al azar con semilla fija. Eso encuentra el error grosero, pero deja pasar el que
 * aparece en una combinación puntual que el muestreo no visitó.
 *
 * Acá se agota el espacio en vez de muestrearlo:
 *
 *  - TODOS los montos de 1 a 400 centavos × TODA cantidad de gente de 1 a 12 × TODO pagador.
 *  - TODOS los subconjuntos posibles de una juntada de 8 (los 255) × TODO pagador.
 *  - TODAS las permutaciones del orden de entrada de un grupo de 5 (las 120).
 *
 * Y en vez de repetir la invariante "suma exacto", se fija la regla COMPLETA del reparto:
 * cuánto le toca a cada uno y a quién le toca el centavo que sobra. La suma exacta se cumple
 * también si el centavo se lo lleva cualquiera; lo que decide si la app está bien es que se
 * lo lleve siempre el mismo, y el que corresponde.
 */

const gente = (n: number): Participante[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nombre: `Persona ${i}`, orden: i }));

const sumaDe = (xs: { montoCentavos: number }[]) => xs.reduce((acc, x) => acc + x.montoCentavos, 0);

const parteDe = (repartos: { participanteId: string; montoCentavos: number }[], id: string) =>
  repartos.find((r) => r.participanteId === id)?.montoCentavos;

const saldoDe = (saldos: Saldo[], id: string) =>
  saldos.find((s) => s.participanteId === id)!.saldoCentavos;

const porOrden = (a: Participante, b: Participante) => a.orden - b.orden || (a.id < b.id ? -1 : 1);

/** Los 2ⁿ−1 subconjuntos no vacíos, para agotar "quiénes participan de este gasto". */
function subconjuntos<T>(xs: T[]): T[][] {
  const salida: T[][] = [];
  for (let mascara = 1; mascara < 1 << xs.length; mascara++) {
    salida.push(xs.filter((_, i) => (mascara & (1 << i)) !== 0));
  }
  return salida;
}

function* permutaciones<T>(xs: T[]): Generator<T[]> {
  if (xs.length <= 1) {
    yield [...xs];
    return;
  }
  for (let i = 0; i < xs.length; i++) {
    for (const resto of permutaciones([...xs.slice(0, i), ...xs.slice(i + 1)])) {
      yield [xs[i], ...resto];
    }
  }
}

/**
 * Implementación independiente del reparto, para contrastar contra la real.
 *
 * Reparte de a UN centavo por vez, dando la vuelta a la mesa: primero el que pagó y después
 * el resto por orden de incorporación. Es la versión ingenua —O(monto), inservible en
 * producción— pero es exactamente lo que la regla dice en castellano, escrita sin mirar
 * `repartirIgual`. Que las dos coincidan en todos los montos chicos es la prueba de que la
 * versión con división y residuo no se desvía de la regla que dice implementar.
 */
function repartoCentavoPorCentavo(
  montoCentavos: number,
  incluidos: Participante[],
  pagadorId: string,
) {
  const enOrden = [...incluidos].sort(porOrden);
  const cola = [
    ...enOrden.filter((p) => p.id === pagadorId),
    ...enOrden.filter((p) => p.id !== pagadorId),
  ];

  const acumulado = new Map(enOrden.map((p) => [p.id, 0]));
  for (let entregados = 0; entregados < montoCentavos; entregados++) {
    const quien = cola[entregados % cola.length];
    acumulado.set(quien.id, acumulado.get(quien.id)! + 1);
  }

  return enOrden.map((p) => ({ participanteId: p.id, montoCentavos: acumulado.get(p.id)! }));
}

/**
 * La especificación completa de RN-01/RN-02, verificada sobre un reparto cualquiera.
 *
 * No es "la suma da bien": es qué valor exacto tiene cada parte y quiénes son los que se
 * comen el centavo. Un reparto que cumpla todo esto es el único reparto posible.
 *
 * Devuelve el problema encontrado, o `null` si el reparto está bien. Los chequeos están en
 * JS plano y no en `expect` a propósito: se llama decenas de miles de veces por barrido, y
 * un `expect` por regla y por combinación se lleva más tiempo que todo el resto del test.
 * El que llama usa `verificarReparto`, que convierte el problema en una falla.
 */
function revisarReparto(
  montoCentavos: number,
  incluidos: Participante[],
  pagadorId: string,
  partes: { participanteId: string; montoCentavos: number }[],
): string | null {
  const enOrden = [...incluidos].sort(porOrden);
  const n = enOrden.length;
  const base = Math.floor(montoCentavos / n);
  const residuo = montoCentavos - base * n;

  // 1. No se pierde ni se inventa un centavo. La invariante que sostiene todo lo demás.
  const suma = sumaDe(partes);
  if (suma !== montoCentavos) return `la suma dio ${suma} en vez de ${montoCentavos}`;

  // 2. Aparecen exactamente los incluidos, una sola vez, y en orden de incorporación.
  if (partes.length !== n) return `salieron ${partes.length} partes para ${n} incluidos`;
  for (let i = 0; i < n; i++) {
    if (partes[i].participanteId !== enOrden[i].id) {
      return `en la posición ${i} salió ${partes[i].participanteId} y correspondía ${enOrden[i].id}`;
    }
  }

  // 3. Cada parte es `base` o `base+1`. Nadie paga dos centavos de más que otro.
  for (const parte of partes) {
    if (parte.montoCentavos !== base && parte.montoCentavos !== base + 1) {
      return `a ${parte.participanteId} le tocaron ${parte.montoCentavos}, fuera de {${base}, ${base + 1}}`;
    }
  }

  // 4. La cantidad de gente que paga el centavo de más es exactamente el residuo.
  const conExtra = partes.filter((r) => r.montoCentavos === base + 1);
  if (conExtra.length !== residuo) {
    return `pagan el centavo extra ${conExtra.length} personas y el residuo es ${residuo}`;
  }

  // 5. Y son exactamente los primeros de la cola: el pagador primero si participa del gasto,
  //    después el resto por orden de incorporación (RN-02).
  const cola = [
    ...enOrden.filter((p) => p.id === pagadorId),
    ...enOrden.filter((p) => p.id !== pagadorId),
  ];
  const esperados = new Set(cola.slice(0, residuo).map((p) => p.id));
  for (const parte of conExtra) {
    if (!esperados.has(parte.participanteId)) {
      return `${parte.participanteId} pagó el centavo extra y no le tocaba`;
    }
  }

  // 6. Si sobra aunque sea un centavo y el que pagó participa, el centavo es de él.
  if (residuo > 0 && enOrden.some((p) => p.id === pagadorId)) {
    if (parteDe(partes, pagadorId) !== base + 1) {
      return `el pagador ${pagadorId} no se comió el centavo que le corresponde`;
    }
  }

  return null;
}

function verificarReparto(
  montoCentavos: number,
  incluidos: Participante[],
  pagadorId: string,
  partes: { participanteId: string; montoCentavos: number }[],
) {
  const problema = revisarReparto(montoCentavos, incluidos, pagadorId, partes);
  if (problema !== null) {
    const quienes = incluidos.map((p) => p.id).join(",");
    expect.fail(`monto=${montoCentavos} incluidos=[${quienes}] pagador=${pagadorId}: ${problema}`);
  }
}

describe("reparto de un gasto: barrido exhaustivo", () => {
  it("cumple la regla completa para todo monto de 1 a 400 entre 1 y 12 personas", () => {
    // 400 montos × 12 tamaños de grupo × cada pagador posible. Agota los residuos: para cada
    // cantidad de gente se visitan todos los restos posibles de la división, varias veces.
    let combinaciones = 0;
    for (let n = 1; n <= 12; n++) {
      const grupo = gente(n);
      for (let monto = 1; monto <= 400; monto++) {
        for (const pagador of grupo) {
          verificarReparto(monto, grupo, pagador.id, repartirIgual(monto, grupo, pagador.id));
          combinaciones++;
        }
      }
    }

    // Que el barrido corrió de verdad: 400 montos × (1+2+…+12) pagadores.
    expect(combinaciones).toBe(400 * 78);
  });

  it("coincide con repartir de a un centavo dando la vuelta a la mesa", () => {
    // Contraste contra la implementación ingenua e independiente. Si `repartirIgual` se
    // desviara de la regla escrita en castellano, es acá donde se vería.
    let comparaciones = 0;
    for (let n = 1; n <= 10; n++) {
      const grupo = gente(n);
      for (let monto = 1; monto <= 300; monto++) {
        for (const pagador of grupo) {
          const real = repartirIgual(monto, grupo, pagador.id);
          const ingenuo = repartoCentavoPorCentavo(monto, grupo, pagador.id);
          for (let i = 0; i < real.length; i++) {
            if (
              real[i].participanteId !== ingenuo[i].participanteId ||
              real[i].montoCentavos !== ingenuo[i].montoCentavos
            ) {
              expect.fail(
                `monto=${monto} n=${n} pagador=${pagador.id}: a ${ingenuo[i].participanteId} ` +
                  `le tocaron ${real[i].montoCentavos} y de a un centavo le tocan ${ingenuo[i].montoCentavos}`,
              );
            }
          }
          comparaciones++;
        }
      }
    }

    expect(comparaciones).toBe(300 * 55);
  });

  it("cumple la regla en montos grandes y en los bordes del entero seguro", () => {
    // Los montos que la app puede ver de verdad (hasta cientos de millones de centavos) más
    // los que la rompen si en algún lado se coló un float.
    const montos = [
      1, 2, 3, 99, 100, 101, 999, 1_000, 1_001, 99_999, 100_000, 999_999, 1_000_000,
      12_345_678, 99_999_999, 123_456_789, 999_999_999_999, Number.MAX_SAFE_INTEGER - 1,
      Number.MAX_SAFE_INTEGER,
    ];

    for (let n = 1; n <= 12; n++) {
      const grupo = gente(n);
      for (const monto of montos) {
        for (const pagador of grupo) {
          const partes = repartirIgual(monto, grupo, pagador.id);
          verificarReparto(monto, grupo, pagador.id, partes);
          // Ninguna parte deja de ser un entero seguro: si apareciera un float, acá se cae.
          expect(partes.every((r) => Number.isSafeInteger(r.montoCentavos))).toBe(true);
        }
      }
    }
  });

  it("cumple la regla en TODOS los subconjuntos de una juntada de 8", () => {
    // "Quiénes participan de este gasto" es una casilla por persona, así que el espacio real
    // de divisiones son los 255 subconjuntos no vacíos. Se recorren todos, y para cada uno
    // todo pagador posible: incluido el caso en que el que pagó NO participa del gasto.
    const grupo = gente(8);
    const montos = [1, 7, 100, 999, 1_000_000, 12_345_679];

    let combinaciones = 0;
    for (const incluidos of subconjuntos(grupo)) {
      for (const pagador of grupo) {
        for (const monto of montos) {
          verificarReparto(monto, incluidos, pagador.id, repartirIgual(monto, incluidos, pagador.id));
          combinaciones++;
        }
      }
    }

    // Que el barrido haya corrido de verdad: 255 subconjuntos × 8 pagadores × 6 montos.
    expect(combinaciones).toBe(255 * 8 * montos.length);
  });

  it("no depende del orden en que lleguen los participantes", () => {
    /**
     * Esto no es teórico. `validarParticipantes` en `acciones.ts` hace un SELECT … WHERE id
     * IN (…) SIN cláusula ORDER BY, así que el orden de las filas que llegan a `repartirIgual`
     * lo decide Postgres y puede cambiar entre dos ejecuciones idénticas.
     *
     * Si el reparto dependiera del orden del array, editar un gasto sin tocarlo podría
     * moverle el centavo a otra persona. El sort interno por `orden` es lo que lo impide, y
     * esto lo fija: las 120 permutaciones de un grupo de 5 tienen que dar lo mismo, byte a byte.
     */
    const grupo = gente(5);
    for (const monto of [1, 7, 1_000_000, 12_345_678]) {
      for (const pagador of grupo) {
        const esperado = repartirIgual(monto, grupo, pagador.id);
        for (const mezclado of permutaciones(grupo)) {
          expect(
            repartirIgual(monto, mezclado, pagador.id),
            `monto=${monto} pagador=${pagador.id} orden=${mezclado.map((p) => p.id).join(",")}`,
          ).toEqual(esperado);
        }
      }
    }
  });

  it("desempata por id cuando dos participantes comparten el mismo orden", () => {
    // No debería pasar, pero si la base devolviera dos filas con el mismo `orden`, el reparto
    // tiene que seguir siendo el mismo siempre y no quedar a merced del orden de llegada.
    const empatados: Participante[] = [
      { id: "pz", nombre: "Zoe", orden: 3 },
      { id: "pa", nombre: "Ana", orden: 3 },
      { id: "pm", nombre: "Mar", orden: 3 },
    ];

    const esperado = repartirIgual(100, empatados, "pm");
    // Con todos empatados en `orden`, manda el id: pa, pm, pz.
    expect(esperado.map((r) => r.participanteId)).toEqual(["pa", "pm", "pz"]);
    for (const mezclado of permutaciones(empatados)) {
      expect(repartirIgual(100, mezclado, "pm")).toEqual(esperado);
    }
  });

  it("rechaza las entradas que no son un gasto válido", () => {
    const tres = gente(3);

    expect(() => repartirIgual(0, tres, "p0"), "monto cero").toThrow();
    expect(() => repartirIgual(-1, tres, "p0"), "monto negativo").toThrow();
    expect(() => repartirIgual(0.5, tres, "p0"), "monto fraccionario").toThrow();
    expect(() => repartirIgual(10.01, tres, "p0"), "pesos en vez de centavos").toThrow();
    expect(() => repartirIgual(NaN, tres, "p0"), "NaN").toThrow();
    expect(() => repartirIgual(Infinity, tres, "p0"), "infinito").toThrow();
    expect(() => repartirIgual(2 ** 53, tres, "p0"), "más allá del entero seguro").toThrow();
    expect(() => repartirIgual(100, [], "p0"), "sin participantes").toThrow();

    // Un participante repetido duplicaría su parte y el gasto sumaría de más. Se rechaza en
    // vez de repartir mal; `listaDeIds` ya deduplica antes, esto es la segunda barrera.
    expect(() => repartirIgual(100, [tres[0], tres[1], tres[0]], "p0")).toThrow(/repetidos/i);
  });

  it("le da el centavo al primero por orden cuando el que pagó no participa", () => {
    // Ana paga el remís que usan Beto y Caro: no hay pagador entre los incluidos, así que el
    // centavo cae en el primero por orden de incorporación. Es determinístico y suma exacto,
    // pero es sistemático, y eso es lo que este test deja escrito.
    const [ana, beto, caro] = gente(3);
    const partes = repartirIgual(10_001, [beto, caro], ana.id);

    expect(sumaDe(partes)).toBe(10_001);
    expect(parteDe(partes, beto.id)).toBe(5_001); // Beto, primero por orden, se lo come
    expect(parteDe(partes, caro.id)).toBe(5_000);
    expect(parteDe(partes, ana.id), "Ana no participa del gasto").toBeUndefined();

    // Y se lo come SIEMPRE el mismo: cien gastos así le cargan cien centavos a Beto.
    let deMasDeBeto = 0;
    for (let i = 0; i < 100; i++) {
      deMasDeBeto += parteDe(repartirIgual(10_001, [beto, caro], ana.id), beto.id)! - 5_000;
    }
    expect(deMasDeBeto, "el sesgo es sistemático: un peso en cien gastos").toBe(100);
  });
});

describe("la plata se conserva a lo largo de toda la juntada", () => {
  /**
   * La invariante Σ(saldos) = 0 ya está cubierta. Lo que se agrega acá es la conservación
   * fuerte, que es más difícil de cumplir por accidente:
   *
   *   Σ(lo que puso cada uno) = Σ(lo que le corresponde a cada uno) = Σ(los gastos)
   *
   * Σ(saldos)=0 se cumple igual si los repartos están mal repartidos entre las personas
   * equivocadas. Esto no.
   */
  it("total gastado = total puesto = total que le corresponde a la gente", () => {
    for (let semilla = 1; semilla <= 300; semilla++) {
      const rnd = random(semilla + 31_000);
      const n = 1 + Math.floor(rnd() * 10);
      const grupo = gente(n);

      const gastos: Gasto[] = [];
      for (let g = 0; g < 1 + Math.floor(rnd() * 15); g++) {
        const incluidos = grupo.filter(() => rnd() > 0.4);
        if (incluidos.length === 0) incluidos.push(grupo[Math.floor(rnd() * n)]);
        const monto = 1 + Math.floor(rnd() * 9_000_000);
        const pagador = grupo[Math.floor(rnd() * n)];
        gastos.push({
          id: `g${g}`,
          descripcion: `Gasto ${g}`,
          montoCentavos: monto,
          pagadorId: pagador.id,
          repartos: repartirIgual(monto, incluidos, pagador.id),
        });
      }

      const total = totalGastado(gastos);
      const saldos = calcularSaldos(grupo, gastos, []);

      expect(saldos.reduce((acc, s) => acc + s.puestoCentavos, 0), `puesto · ${semilla}`).toBe(total);
      expect(
        saldos.reduce((acc, s) => acc + s.correspondeCentavos, 0),
        `corresponde · ${semilla}`,
      ).toBe(total);
      expect(saldos.reduce((acc, s) => acc + s.saldoCentavos, 0), `saldos · ${semilla}`).toBe(0);
    }
  });

  it("nadie carga con más de un centavo de injusticia por gasto", () => {
    /**
     * El redondeo de cada gasto es justo (nadie paga más de un centavo que otro), pero el
     * sesgo podría ACUMULARSE a lo largo de la juntada hasta volverse visible.
     *
     * Acá se compara lo que le tocó a cada uno contra su parte ideal exacta (la fracción, sin
     * redondear) y se exige que la diferencia nunca supere la cantidad de gastos en los que
     * participó. Es decir: como máximo un centavo de desvío por gasto, nunca más.
     */
    for (let semilla = 1; semilla <= 200; semilla++) {
      const rnd = random(semilla + 77_000);
      const n = 2 + Math.floor(rnd() * 9);
      const grupo = gente(n);

      const gastos: Gasto[] = [];
      const idealPorPersona = new Map(grupo.map((p) => [p.id, 0]));
      const gastosPorPersona = new Map(grupo.map((p) => [p.id, 0]));

      for (let g = 0; g < 1 + Math.floor(rnd() * 20); g++) {
        const incluidos = grupo.filter(() => rnd() > 0.35);
        if (incluidos.length === 0) incluidos.push(grupo[Math.floor(rnd() * n)]);
        const monto = 1 + Math.floor(rnd() * 3_000_000);
        const pagador = grupo[Math.floor(rnd() * n)];

        for (const p of incluidos) {
          idealPorPersona.set(p.id, idealPorPersona.get(p.id)! + monto / incluidos.length);
          gastosPorPersona.set(p.id, gastosPorPersona.get(p.id)! + 1);
        }

        gastos.push({
          id: `g${g}`,
          descripcion: `Gasto ${g}`,
          montoCentavos: monto,
          pagadorId: pagador.id,
          repartos: repartirIgual(monto, incluidos, pagador.id),
        });
      }

      for (const s of calcularSaldos(grupo, gastos, [])) {
        const desvio = Math.abs(s.correspondeCentavos - idealPorPersona.get(s.participanteId)!);
        expect(
          desvio,
          `desvío acumulado de ${s.nombre} · semilla ${semilla}`,
        ).toBeLessThanOrEqual(gastosPorPersona.get(s.participanteId)!);
      }
    }
  });

  it("confía en que los repartos sumen el monto: no lo revisa", () => {
    /**
     * Límite conocido de `calcularSaldos`, escrito acá para que sea una decisión y no una
     * sorpresa. La invariante Σ(saldos)=0 NO se sostiene sola: se sostiene porque el único
     * que arma repartos es `repartirIgual`, y ese siempre suma exacto.
     *
     * Si alguna vez entrara un gasto con repartos que no suman su monto —una migración a
     * mano, un `editarGasto` que cambie el monto sin recalcular las partes— las cuentas se
     * descuadran en silencio y ningún chequeo lo frena. Hoy no puede pasar: las dos acciones
     * que tocan un gasto recalculan el reparto entero. Si eso cambia, este test es el aviso.
     */
    const [ana, beto] = gente(2);
    const inconsistente: Gasto = {
      id: "g1",
      descripcion: "Carne",
      montoCentavos: 1_000,
      pagadorId: ana.id,
      // Reparto de un gasto de $10 que solo cubre $6: faltan 400 centavos.
      repartos: [
        { participanteId: ana.id, montoCentavos: 300 },
        { participanteId: beto.id, montoCentavos: 300 },
      ],
    };

    const saldos = calcularSaldos([ana, beto], [inconsistente], []);
    expect(saldos.reduce((acc, s) => acc + s.saldoCentavos, 0), "se descuadra en silencio").toBe(
      400,
    );
  });

  it("rompe fuerte si un gasto referencia a alguien que no está en la juntada", () => {
    // Un descuadre silencioso es peor que un error: si una referencia quedó colgada, mejor
    // que reviente acá y no que las cuentas cierren en cero estando mal.
    const [ana, beto] = gente(2);

    const conPagadorFantasma: Gasto = {
      id: "g1",
      descripcion: "Carne",
      montoCentavos: 1_000,
      pagadorId: "fantasma",
      repartos: repartirIgual(1_000, [ana, beto], ana.id),
    };
    expect(() => calcularSaldos([ana, beto], [conPagadorFantasma], [])).toThrow(/Carne/);

    const conRepartoFantasma: Gasto = {
      id: "g2",
      descripcion: "Bebida",
      montoCentavos: 1_000,
      pagadorId: ana.id,
      repartos: [{ participanteId: "fantasma", montoCentavos: 1_000 }],
    };
    expect(() => calcularSaldos([ana, beto], [conRepartoFantasma], [])).toThrow(/Bebida/);

    const pagoFantasma: Pago = { id: "x", deId: beto.id, aId: "fantasma", montoCentavos: 500 };
    expect(() => calcularSaldos([ana, beto], [], [pagoFantasma])).toThrow(/pago/i);
  });
});

describe("juntadas de verdad, con los números hechos a mano", () => {
  /**
   * Los barridos prueban propiedades; estos prueban RESULTADOS. Si el motor cambiara de regla
   * y siguiera cumpliendo todas las invariantes, los barridos no se enterarían y estos sí.
   *
   * Cada número de acá está calculado a mano en el comentario, no copiado de la salida.
   */
  it("el asado clásico: cuatro personas, tres gastos, uno con resto", () => {
    const [ana, beto, caro, dani] = gente(4);
    const todos = [ana, beto, caro, dani];

    const gastos: Gasto[] = [
      {
        // Carne $15.000, paga Ana, comen los cuatro. 1.500.000 / 4 = 375.000 justo.
        id: "g1",
        descripcion: "Carne",
        montoCentavos: 1_500_000,
        pagadorId: ana.id,
        repartos: repartirIgual(1_500_000, todos, ana.id),
      },
      {
        // Bebida $4.500, paga Beto, Dani no toma. 450.000 / 3 = 150.000 justo.
        id: "g2",
        descripcion: "Bebida",
        montoCentavos: 450_000,
        pagadorId: beto.id,
        repartos: repartirIgual(450_000, [ana, beto, caro], beto.id),
      },
      {
        // Postre $2.000, paga Dani, Beto no come. 200.000 / 3 = 66.666,67 → sobran 2 centavos.
        // Cola: Dani (pagó), Ana, Caro. Dani 66.667, Ana 66.667, Caro 66.666. Suma 200.000.
        id: "g3",
        descripcion: "Postre",
        montoCentavos: 200_000,
        pagadorId: dani.id,
        repartos: repartirIgual(200_000, [ana, caro, dani], dani.id),
      },
    ];

    expect(totalGastado(gastos)).toBe(2_150_000); // $21.500

    const g3 = gastos[2].repartos;
    expect(parteDe(g3, dani.id)).toBe(66_667);
    expect(parteDe(g3, ana.id)).toBe(66_667);
    expect(parteDe(g3, caro.id)).toBe(66_666);

    const saldos = calcularSaldos(todos, gastos, []);

    // Ana: puso 1.500.000; le toca 375.000 + 150.000 + 66.667 = 591.667 → +908.333
    expect(saldos[0]).toMatchObject({ puestoCentavos: 1_500_000, correspondeCentavos: 591_667 });
    expect(saldoDe(saldos, ana.id)).toBe(908_333);
    // Beto: puso 450.000; le toca 375.000 + 150.000 = 525.000 → −75.000
    expect(saldoDe(saldos, beto.id)).toBe(-75_000);
    // Caro: no puso nada; le toca 375.000 + 150.000 + 66.666 = 591.666 → −591.666
    expect(saldoDe(saldos, caro.id)).toBe(-591_666);
    // Dani: puso 200.000; le toca 375.000 + 66.667 = 441.667 → −241.667
    expect(saldoDe(saldos, dani.id)).toBe(-241_667);
    expect(saldos.reduce((acc, s) => acc + s.saldoCentavos, 0)).toBe(0);

    // Liquidación: Ana es la única acreedora, así que los tres le transfieren a ella, de
    // mayor a menor deuda. Tres transferencias, que es n−1.
    expect(liquidacionMinima(saldos)).toEqual([
      { deId: caro.id, deNombre: caro.nombre, aId: ana.id, aNombre: ana.nombre, montoCentavos: 591_666 },
      { deId: dani.id, deNombre: dani.nombre, aId: ana.id, aNombre: ana.nombre, montoCentavos: 241_667 },
      { deId: beto.id, deNombre: beto.nombre, aId: ana.id, aNombre: ana.nombre, montoCentavos: 75_000 },
    ]);

    // Y en pantalla se lee así.
    expect(formatearPesos(908_333)).toBe("$9.083,33");
    expect(formatearPesos(-591_666)).toBe("-$5.916,66");
  });

  it("cuando cada uno puso lo mismo, no hay nada que transferir", () => {
    // Tres gastos iguales, uno por cabeza, todos participan. Todo el mundo en cero.
    const grupo = gente(3);
    const gastos: Gasto[] = grupo.map((p, i) => ({
      id: `g${i}`,
      descripcion: `Ronda ${i}`,
      montoCentavos: 300_000,
      pagadorId: p.id,
      repartos: repartirIgual(300_000, grupo, p.id),
    }));

    const saldos = calcularSaldos(grupo, gastos, []);
    expect(saldos.map((s) => s.saldoCentavos)).toEqual([0, 0, 0]);
    expect(liquidacionMinima(saldos)).toEqual([]);
  });

  it("una juntada de dos personas donde una paga todo", () => {
    // El caso más chico que existe, y el que más se usa. $1.234,57 entre dos: sobra 1 centavo
    // y se lo come el que pagó.
    const [ana, beto] = gente(2);
    const gastos: Gasto[] = [
      {
        id: "g1",
        descripcion: "Cena",
        montoCentavos: 123_457,
        pagadorId: ana.id,
        repartos: repartirIgual(123_457, [ana, beto], ana.id),
      },
    ];

    expect(gastos[0].repartos.map((r) => r.montoCentavos)).toEqual([61_729, 61_728]);

    const saldos = calcularSaldos([ana, beto], gastos, []);
    expect(saldoDe(saldos, ana.id)).toBe(61_728);
    expect(saldoDe(saldos, beto.id)).toBe(-61_728);

    expect(liquidacionMinima(saldos)).toEqual([
      { deId: beto.id, deNombre: beto.nombre, aId: ana.id, aNombre: ana.nombre, montoCentavos: 61_728 },
    ]);
  });

  it("gastos personales: uno se banca algo solo y el resto no lo paga", () => {
    // Caro se compra un cigarrillo aparte. Es un gasto de un solo participante: le toca todo
    // a él, y no mueve el saldo de nadie más.
    const [ana, beto, caro] = gente(3);
    const todos = [ana, beto, caro];

    const gastos: Gasto[] = [
      {
        id: "g1",
        descripcion: "Carne",
        montoCentavos: 900_000,
        pagadorId: ana.id,
        repartos: repartirIgual(900_000, todos, ana.id),
      },
      {
        // Lo paga Ana pero es solo para Caro: Caro le queda debiendo el total.
        id: "g2",
        descripcion: "Puchos de Caro",
        montoCentavos: 250_000,
        pagadorId: ana.id,
        repartos: repartirIgual(250_000, [caro], ana.id),
      },
    ];

    expect(gastos[1].repartos).toEqual([{ participanteId: caro.id, montoCentavos: 250_000 }]);

    const saldos = calcularSaldos(todos, gastos, []);
    expect(saldoDe(saldos, ana.id)).toBe(850_000); // 1.150.000 puesto − 300.000
    expect(saldoDe(saldos, beto.id)).toBe(-300_000); // solo la carne
    expect(saldoDe(saldos, caro.id)).toBe(-550_000); // carne + puchos
  });

  it("saldar de a poco: la liquidación se va achicando y termina en nada", () => {
    // La juntada real no se salda de un saque. Se paga una parte, después otra, y la pantalla
    // tiene que ir mostrando el resto sin descuadrarse nunca.
    const [ana, beto, caro] = gente(3);
    const todos = [ana, beto, caro];
    const gastos: Gasto[] = [
      {
        id: "g1",
        descripcion: "Carne",
        montoCentavos: 1_000_000,
        pagadorId: ana.id,
        repartos: repartirIgual(1_000_000, todos, ana.id),
      },
    ];

    const pagos: Pago[] = [];
    const paso1 = calcularSaldos(todos, gastos, pagos);
    expect(paso1.map((s) => s.saldoCentavos)).toEqual([666_666, -333_333, -333_333]);

    // Beto transfiere la mitad de lo suyo.
    pagos.push({ id: "p1", deId: beto.id, aId: ana.id, montoCentavos: 166_666 });
    const paso2 = calcularSaldos(todos, gastos, pagos);
    expect(saldoDe(paso2, beto.id)).toBe(-166_667);
    expect(saldoDe(paso2, ana.id)).toBe(500_000);
    expect(paso2.reduce((acc, s) => acc + s.saldoCentavos, 0)).toBe(0);

    // Caro paga todo lo suyo de una.
    pagos.push({ id: "p2", deId: caro.id, aId: ana.id, montoCentavos: 333_333 });
    const paso3 = calcularSaldos(todos, gastos, pagos);
    expect(saldoDe(paso3, caro.id)).toBe(0);
    expect(liquidacionMinima(paso3)).toEqual([
      { deId: beto.id, deNombre: beto.nombre, aId: ana.id, aNombre: ana.nombre, montoCentavos: 166_667 },
    ]);

    // Y Beto cierra con el resto.
    pagos.push({ id: "p3", deId: beto.id, aId: ana.id, montoCentavos: 166_667 });
    const final = calcularSaldos(todos, gastos, pagos);
    expect(final.map((s) => s.saldoCentavos)).toEqual([0, 0, 0]);
    expect(liquidacionMinima(final)).toEqual([]);
  });

  it("aguanta una juntada del tamaño máximo que permite la app", () => {
    // MAX_PARTICIPANTES son 60. Sesenta personas y sesenta gastos, con montos que no dividen
    // exacto casi nunca: es el peor caso realista para el redondeo.
    const grupo = gente(60);
    const gastos: Gasto[] = grupo.map((p, i) => {
      const monto = 100_000 + i * 7_777 + 1;
      // Cada gasto lo comparte una porción distinta del grupo.
      const incluidos = grupo.filter((_, j) => (j + i) % (2 + (i % 5)) === 0);
      const efectivos = incluidos.length > 0 ? incluidos : [p];
      return {
        id: `g${i}`,
        descripcion: `Gasto ${i}`,
        montoCentavos: monto,
        pagadorId: p.id,
        repartos: repartirIgual(monto, efectivos, p.id),
      };
    });

    for (const gasto of gastos) {
      expect(sumaDe(gasto.repartos), `gasto ${gasto.id}`).toBe(gasto.montoCentavos);
    }

    const saldos = calcularSaldos(grupo, gastos, []);
    expect(saldos.reduce((acc, s) => acc + s.correspondeCentavos, 0)).toBe(totalGastado(gastos));
    expect(saldos.reduce((acc, s) => acc + s.saldoCentavos, 0)).toBe(0);

    const liquidacion = liquidacionMinima(saldos);
    expect(liquidacion.length).toBeLessThanOrEqual(59);

    const saldados = calcularSaldos(
      grupo,
      gastos,
      liquidacion.map((t, i) => ({ id: `l${i}`, deId: t.deId, aId: t.aId, montoCentavos: t.montoCentavos })),
    );
    expect(saldados.every((s) => s.saldoCentavos === 0)).toBe(true);
  });
});

describe("de lo que se tipea a lo que se debe, sin escalón intermedio", () => {
  /**
   * La cadena completa que recorre un gasto de verdad:
   *
   *   texto del input → parsearPesos → repartirIgual → calcularSaldos → liquidacionMinima
   *                                                                   → formatearPesos
   *
   * Los tests de `dinero.test.ts` cubren el primer eslabón y los del motor cubren los del
   * medio, pero ninguno cubre la junta entre ellos. Un error de escala —"10.000" leído como
   * diez pesos— no rompe ninguna invariante del motor: el reparto sigue sumando exacto y los
   * saldos siguen dando cero. Solo se ve mirando la cadena entera de punta a punta.
   */
  it("una juntada cargada tal como se tipea en el teléfono", () => {
    const [ana, beto, caro] = gente(3);
    const todos = [ana, beto, caro];

    const tipeados: [string, Participante, Participante[]][] = [
      ["$ 15.000", ana, todos], // separador de miles con símbolo
      ["4.500,50", beto, [ana, beto]], // miles y decimales, Caro no toma
      ["1.200", caro, todos], // punto de miles: son mil doscientos, no doce
    ];

    const gastos: Gasto[] = tipeados.map(([texto, pagador, incluidos], i) => {
      const monto = parsearPesos(texto);
      expect(monto, `no se pudo leer ${texto}`).not.toBeNull();
      return {
        id: `g${i}`,
        descripcion: texto,
        montoCentavos: monto!,
        pagadorId: pagador.id,
        repartos: repartirIgual(monto!, incluidos, pagador.id),
      };
    });

    // La escala es lo que se está verificando: $15.000 son 1.500.000 centavos, no 1.500.
    expect(gastos.map((g) => g.montoCentavos)).toEqual([1_500_000, 450_050, 120_000]);
    expect(totalGastado(gastos)).toBe(2_070_050);
    expect(formatearPesos(totalGastado(gastos))).toBe("$20.700,50");

    const saldos = calcularSaldos(todos, gastos, []);
    // Ana: puso 1.500.000; le toca 500.000 + 225.025 + 40.000 = 765.025 → +734.975
    expect(saldoDe(saldos, ana.id)).toBe(734_975);
    // Beto: puso 450.050; le toca 500.000 + 225.025 + 40.000 = 765.025 → −314.975
    expect(saldoDe(saldos, beto.id)).toBe(-314_975);
    // Caro: puso 120.000; le toca 500.000 + 40.000 = 540.000 → −420.000
    expect(saldoDe(saldos, caro.id)).toBe(-420_000);
    expect(saldos.reduce((acc, s) => acc + s.saldoCentavos, 0)).toBe(0);

    const liquidacion = liquidacionMinima(saldos);
    expect(liquidacion.map((t) => [t.deNombre, t.aNombre, formatearPesos(t.montoCentavos)])).toEqual([
      [caro.nombre, ana.nombre, "$4.200"],
      [beto.nombre, ana.nombre, "$3.149,75"],
    ]);
  });

  it("todo monto que se pueda tipear se reparte y se lee sin perder un centavo", () => {
    // Barrido sobre el texto, no sobre el número: se recorre la cadena entera para cada monto
    // y se exige que lo que se muestra en pantalla se pueda volver a tipear igual.
    const grupo = gente(4);
    for (let pesos = 1; pesos <= 2_000; pesos++) {
      for (const centavos of ["", ",01", ",99", ",50"]) {
        const texto = `${pesos}${centavos}`;
        const monto = parsearPesos(texto)!;
        expect(Number.isSafeInteger(monto), texto).toBe(true);

        const partes = repartirIgual(monto, grupo, grupo[1].id);
        verificarReparto(monto, grupo, grupo[1].id, partes);

        // Cada parte, mostrada en pantalla, se vuelve a leer como el mismo número.
        for (const parte of partes) {
          expect(parsearPesos(formatearPesos(parte.montoCentavos)), texto).toBe(parte.montoCentavos);
        }
      }
    }
  });
});

describe("la liquidación, hasta donde llega", () => {
  it("nunca manda plata a alguien que ya está en cero, en ningún escenario", () => {
    // Barrido con juntadas al azar más agresivo que el existente: más gente, más gastos y
    // pagos sueltos previos, que es donde aparecen los saldos raros.
    for (let semilla = 1; semilla <= 300; semilla++) {
      const rnd = random(semilla + 44_000);
      const n = 2 + Math.floor(rnd() * 11);
      const grupo = gente(n);

      const gastos: Gasto[] = [];
      for (let g = 0; g < 1 + Math.floor(rnd() * 15); g++) {
        const incluidos = grupo.filter(() => rnd() > 0.4);
        if (incluidos.length === 0) incluidos.push(grupo[Math.floor(rnd() * n)]);
        const monto = 1 + Math.floor(rnd() * 4_000_000);
        const pagador = grupo[Math.floor(rnd() * n)];
        gastos.push({
          id: `g${g}`,
          descripcion: `Gasto ${g}`,
          montoCentavos: monto,
          pagadorId: pagador.id,
          repartos: repartirIgual(monto, incluidos, pagador.id),
        });
      }

      const pagos: Pago[] = [];
      for (let p = 0; p < Math.floor(rnd() * 8); p++) {
        const de = Math.floor(rnd() * n);
        const a = (de + 1 + Math.floor(rnd() * (n - 1))) % n;
        pagos.push({
          id: `p${p}`,
          deId: grupo[de].id,
          aId: grupo[a].id,
          montoCentavos: 1 + Math.floor(rnd() * 2_000_000),
        });
      }

      const saldos = calcularSaldos(grupo, gastos, pagos);
      const liquidacion = liquidacionMinima(saldos);
      const saldoPorId = new Map(saldos.map((s) => [s.participanteId, s.saldoCentavos]));
      const neto = new Map<string, number>();

      for (const t of liquidacion) {
        expect(t.deId, "nadie se paga a sí mismo").not.toBe(t.aId);
        expect(t.montoCentavos, "ninguna transferencia en cero").toBeGreaterThan(0);
        expect(saldoPorId.get(t.deId)!, `${t.deNombre} no debía nada`).toBeLessThan(0);
        expect(saldoPorId.get(t.aId)!, `a ${t.aNombre} no le debían nada`).toBeGreaterThan(0);
        neto.set(t.deId, (neto.get(t.deId) ?? 0) - t.montoCentavos);
        neto.set(t.aId, (neto.get(t.aId) ?? 0) + t.montoCentavos);
      }

      // Lo que cada uno manda o recibe iguala exactamente su saldo.
      for (const s of saldos) {
        expect(neto.get(s.participanteId) ?? 0, `neto de ${s.nombre} · ${semilla}`).toBe(
          s.saldoCentavos,
        );
      }

      const enJuego = saldos.filter((s) => s.saldoCentavos !== 0).length;
      if (enJuego > 0) expect(liquidacion.length).toBeLessThanOrEqual(enJuego - 1);
    }
  });

  it("es determinística aunque los saldos lleguen mezclados y con empates", () => {
    // Los empates son el caso frágil: cuatro personas debiendo exactamente lo mismo. Si el
    // desempate no fuera por orden de incorporación, dos celulares mostrarían listas distintas.
    const grupo = gente(6);
    const gastos: Gasto[] = [
      {
        id: "g1",
        descripcion: "Alquiler",
        montoCentavos: 1_200_000,
        pagadorId: grupo[0].id,
        repartos: repartirIgual(1_200_000, grupo, grupo[0].id),
      },
      {
        id: "g2",
        descripcion: "Nafta",
        montoCentavos: 600_000,
        pagadorId: grupo[1].id,
        repartos: repartirIgual(600_000, grupo, grupo[1].id),
      },
    ];

    const saldos = calcularSaldos(grupo, gastos, []);
    // Cuatro personas empatadas debiendo lo mismo: 200.000 + 100.000 cada una.
    expect(saldos.slice(2).map((s) => s.saldoCentavos)).toEqual([
      -300_000, -300_000, -300_000, -300_000,
    ]);

    const esperada = liquidacionMinima(saldos);
    const rnd = random(4_242);
    for (let intento = 0; intento < 50; intento++) {
      const mezclados = [...saldos].sort(() => rnd() - 0.5);
      expect(liquidacionMinima(mezclados), `intento ${intento}`).toEqual(esperada);
    }

    // Y con empate, el que aparece primero es el que se incorporó antes.
    expect(esperada[0].deNombre).toBe(grupo[2].nombre);
  });

  it("el greedy no siempre da el mínimo absoluto, y así está documentado", () => {
    /**
     * Límite CONOCIDO y aceptado (está escrito en `liquidacion.ts`): el mínimo real de
     * transferencias es NP-hard, y esto es el greedy estándar.
     *
     * Este es un caso concreto donde se nota. Saldos +5, +4, −3, −2, −4:
     *
     *   Óptimo, 3 transferencias:  (−3 y −2) → +5,  y  −4 → +4
     *   Greedy, 4 transferencias:  parte el −3 en dos porque arranca por el más grande
     *
     * Son transferencias de más, no plata de más: todo el mundo termina en cero igual. El
     * test está para que, si algún día se cambia el algoritmo, se vea que esto mejoró.
     */
    const saldos: Saldo[] = [
      { participanteId: "p0", nombre: "Ana", orden: 0, puestoCentavos: 5, correspondeCentavos: 0, saldoCentavos: 5 },
      { participanteId: "p1", nombre: "Beto", orden: 1, puestoCentavos: 4, correspondeCentavos: 0, saldoCentavos: 4 },
      { participanteId: "p2", nombre: "Caro", orden: 2, puestoCentavos: 0, correspondeCentavos: 3, saldoCentavos: -3 },
      { participanteId: "p3", nombre: "Dani", orden: 3, puestoCentavos: 0, correspondeCentavos: 2, saldoCentavos: -2 },
      { participanteId: "p4", nombre: "Eze", orden: 4, puestoCentavos: 0, correspondeCentavos: 4, saldoCentavos: -4 },
    ];

    const liquidacion = liquidacionMinima(saldos);
    expect(liquidacion.length, "hoy da 4; el óptimo sería 3").toBe(4);

    // Lo que NO se negocia se sigue cumpliendo: todos terminan en cero exacto.
    const neto = new Map<string, number>();
    for (const t of liquidacion) {
      neto.set(t.deId, (neto.get(t.deId) ?? 0) - t.montoCentavos);
      neto.set(t.aId, (neto.get(t.aId) ?? 0) + t.montoCentavos);
    }
    for (const s of saldos) {
      expect(neto.get(s.participanteId) ?? 0).toBe(s.saldoCentavos);
    }
  });
});

/** PRNG con semilla fija: un barrido aleatorio que no se puede reproducir no sirve de nada. */
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
