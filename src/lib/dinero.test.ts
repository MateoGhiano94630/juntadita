import { describe, expect, it } from "vitest";
import { centavosAInput, formatearPesos, parsearPesos } from "./dinero";

/**
 * Tests de la conversión entre lo que la gente tipea y los centavos que guardamos.
 *
 * Es la función de más riesgo del proyecto: un error acá no descuadra las cuentas, las
 * mueve tres órdenes de magnitud. "10.000" interpretado como diez pesos no rompe ninguna
 * invariante —el reparto sigue sumando exacto, los saldos siguen dando cero— así que
 * ningún test del motor lo vería. Se ve solo acá.
 *
 * El caso ambiguo de verdad es el punto solo: "1.500" son mil quinientos pesos y "10.50"
 * son diez con cincuenta. La heurística que los separa es lo que estos tests protegen.
 */

describe("parsearPesos", () => {
  it("interpreta lo que realmente se escribe acá", () => {
    const casos: [string, number][] = [
      // Punto como separador de miles: el caso más común y el más caro de romper.
      ["10.000", 1_000_000],
      ["1.500", 150_000],
      ["1.234.567", 123_456_700],

      // Punto como decimal, al estilo del teclado numérico del celular.
      ["10.50", 1_050],
      ["1.5", 150],

      // Coma decimal, que es lo correcto en es-AR.
      ["10,50", 1_050],
      ["94320,5", 9_432_050],

      // Formato local completo: miles con punto y decimales con coma.
      ["94.320,50", 9_432_050],
      ["1.000.000", 100_000_000],

      // Formato con los separadores al revés (teclado o teléfono en inglés).
      ["1,234.56", 123_456],

      // Con símbolos, espacios y basura alrededor.
      ["$ 1.234", 123_400],
      ["  $12.500  ", 1_250_000],

      // Separador colgando de un lado.
      ["5,", 500],
      [".5", 50],

      ["0", 0],
    ];

    for (const [texto, esperado] of casos) {
      expect(parsearPesos(texto), `parsearPesos(${JSON.stringify(texto)})`).toBe(esperado);
    }
  });

  it("trunca a dos decimales en vez de redondear", () => {
    // Decisión consciente: nadie escribe milésimos de peso, y truncar nunca inventa plata.
    expect(parsearPesos("10,999")).toBe(1_099);
    expect(parsearPesos("0,004")).toBe(0);
    expect(parsearPesos("10.0000")).toBe(1_000);
  });

  it("devuelve null cuando no hay un monto que leer", () => {
    expect(parsearPesos("")).toBeNull();
    expect(parsearPesos("   ")).toBeNull();
    expect(parsearPesos("abc")).toBeNull();
    expect(parsearPesos("$")).toBeNull();
    expect(parsearPesos(",")).toBeNull();
    expect(parsearPesos(".")).toBeNull();

    // Más allá de 2^53 centavos ya no se puede confiar en el entero, así que se rechaza.
    expect(parsearPesos("999999999999999999")).toBeNull();
  });

  it("nunca devuelve algo que no sea un entero seguro", () => {
    // La garantía que sostiene RN-12: lo que sale de acá va derecho a la base como centavos.
    const entradas = ["10.000", "0,01", "1", "99.999.999,99", "0,004", "7,5", "123456,789"];
    for (const texto of entradas) {
      const valor = parsearPesos(texto);
      expect(valor === null || Number.isSafeInteger(valor)).toBe(true);
    }
  });

  /**
   * Comportamiento actual, documentado para que un cambio sea deliberado y no un accidente.
   * No es lo ideal, pero no hace daño: son entradas que en la práctica no se tipean, y el
   * formulario igual rechaza el cero antes de mandar nada.
   */
  it("hoy ignora el signo y la basura intercalada", () => {
    expect(parsearPesos("-50")).toBe(5_000); // el menos se descarta, no se rechaza
    expect(parsearPesos("1e5")).toBe(1_500); // la "e" se descarta y quedan "15"
  });
});

describe("centavosAInput", () => {
  it("arma el texto que va dentro del input al editar", () => {
    expect(centavosAInput(333_334)).toBe("3333,34");
    expect(centavosAInput(1_000)).toBe("10,00");
    expect(centavosAInput(1)).toBe("0,01");
    expect(centavosAInput(0)).toBe("0,00");
  });

  it("no mete separador de miles, porque tiene que poder volver a parsearse", () => {
    expect(centavosAInput(100_000_000)).toBe("1000000,00");
  });
});

describe("ida y vuelta", () => {
  /**
   * La propiedad que protege la edición de un gasto: abrir un gasto guardado, no tocar el
   * monto y confirmar tiene que dejar EXACTAMENTE el mismo número. Si esto se rompe, editar
   * la descripción de un gasto le cambia el monto en silencio.
   */
  it("centavos → input → centavos no pierde nada", () => {
    const valores = [
      ...Array.from({ length: 20_001 }, (_, i) => i),
      ...Array.from({ length: 500 }, (_, i) => 1_000_000 + i * 99_991),
      1, 99, 100, 101, 1_000_000, 123_456_789, 999_999_999_999,
    ];

    for (const centavos of valores) {
      expect(parsearPesos(centavosAInput(centavos)), `centavos=${centavos}`).toBe(centavos);
    }
  });

  /**
   * Y la otra dirección: lo que se muestra en pantalla se tiene que poder volver a tipear.
   * Alguien lee "$3.333,34" del celular del otro y lo escribe en el suyo; tiene que dar lo
   * mismo. Es también la prueba de que el formateo no deforma el número.
   */
  it("centavos → pantalla → centavos no pierde nada", () => {
    const valores = [
      ...Array.from({ length: 20_001 }, (_, i) => i),
      ...Array.from({ length: 500 }, (_, i) => 1_000_000 + i * 99_991),
      100_000, 100_050, 123_456_789, 999_999_999_999,
    ];

    for (const centavos of valores) {
      expect(parsearPesos(formatearPesos(centavos)), `centavos=${centavos}`).toBe(centavos);
    }
  });
});

describe("formatearPesos", () => {
  it("muestra los centavos solo cuando no son cero", () => {
    // No es cosmético: es lo que deja verificar el redondeo a ojo en la pantalla de saldos
    // sin ensuciar todos los demás montos con ",00".
    expect(formatearPesos(100)).toBe("$1");
    expect(formatearPesos(1_000)).toBe("$10");
    expect(formatearPesos(100_000)).toBe("$1.000");
    expect(formatearPesos(0)).toBe("$0");

    expect(formatearPesos(1)).toBe("$0,01");
    expect(formatearPesos(50)).toBe("$0,50");
    expect(formatearPesos(333_334)).toBe("$3.333,34");
  });

  it("no deja entrar un float por la parte decimal", () => {
    // `1010 / 100` da 10.1 y `10.10` en float es 10.099999999999999. La parte decimal se
    // pega a mano desde el entero justo para que esto no pase.
    expect(formatearPesos(1_010)).toBe("$10,10");
    expect(formatearPesos(1_009)).toBe("$10,09");
    expect(formatearPesos(70)).toBe("$0,70");
    expect(formatearPesos(29)).toBe("$0,29");
  });

  it("pone el menos afuera del signo pesos", () => {
    expect(formatearPesos(-183_333)).toBe("-$1.833,33");
    expect(formatearPesos(-100)).toBe("-$1");
  });

  it("separa los miles con punto, como se lee acá", () => {
    expect(formatearPesos(1_000_000)).toBe("$10.000");
    expect(formatearPesos(9_999_999_999)).toBe("$99.999.999,99");
  });

  it("nunca deja escapar un punto flotante en el texto", () => {
    // Un `.999999` o un `e-7` en pantalla es la señal de que se coló una división.
    for (let centavos = 0; centavos < 100_000; centavos += 7) {
      const texto = formatearPesos(centavos);
      expect(texto, `centavos=${centavos}`).not.toMatch(/e-?\d/i);
      // Después de la coma hay exactamente dos dígitos, o no hay coma.
      expect(texto, `centavos=${centavos}`).toMatch(/^\$[\d.]+(,\d{2})?$/);
    }
  });
});
