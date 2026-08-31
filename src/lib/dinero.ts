/**
 * Conversión entre lo que la gente escribe y los centavos enteros que guardamos (RN-12).
 *
 * El parseo trabaja sobre el STRING, nunca con punto flotante. `parseFloat("10.10") * 100`
 * da 1009.9999999999999 y ahí ya perdiste un centavo antes de empezar.
 */

/**
 * Convierte lo que se tipeó a centavos enteros. Devuelve `null` si no es un monto válido.
 *
 * Acepta lo que realmente escribe alguien de acá:
 *   "94.320,50" → 9432050    (formato local completo)
 *   "94320,5"   → 9432050    (coma decimal, un solo decimal)
 *   "10.000"    → 1000000    (punto como separador de miles)
 *   "10.50"     → 1050       (punto como decimal, al estilo del teclado numérico)
 *   "$ 1.234"   → 123400     (con símbolo y espacios)
 */
export function parsearPesos(texto: string): number | null {
  const limpio = texto.replace(/[^\d.,]/g, "");
  if (limpio === "") return null;

  const ultimaComa = limpio.lastIndexOf(",");
  const ultimoPunto = limpio.lastIndexOf(".");

  let separadorDecimal = -1;
  if (ultimaComa !== -1 && ultimoPunto !== -1) {
    // Están los dos: el que va último es el decimal ("94.320,50" o "94,320.50").
    separadorDecimal = Math.max(ultimaComa, ultimoPunto);
  } else if (ultimaComa !== -1) {
    // Solo coma: en es-AR la coma es siempre decimal.
    separadorDecimal = ultimaComa;
  } else if (ultimoPunto !== -1) {
    // Solo punto, ambiguo. "1.500" son mil quinientos pesos; "10.50" son diez con cincuenta.
    // Heurística: exactamente 3 dígitos después del punto y ningún otro punto → miles.
    const decimales = limpio.length - ultimoPunto - 1;
    const hayVariosPuntos = limpio.indexOf(".") !== ultimoPunto;
    separadorDecimal = decimales === 3 || hayVariosPuntos ? -1 : ultimoPunto;
  }

  const entera =
    separadorDecimal === -1
      ? limpio.replace(/[.,]/g, "")
      : limpio.slice(0, separadorDecimal).replace(/[.,]/g, "");
  const decimal =
    separadorDecimal === -1 ? "" : limpio.slice(separadorDecimal + 1).replace(/[.,]/g, "");

  if (entera === "" && decimal === "") return null;

  // Se completa o se trunca a exactamente 2 dígitos. Todo entero, sin floats.
  const centavos = `${decimal}00`.slice(0, 2);
  const total = Number(`${entera || "0"}${centavos}`);

  return Number.isSafeInteger(total) ? total : null;
}

/**
 * Centavos → el texto que va dentro del input al editar un gasto: `333334` → `"3333,34"`.
 * Sin separador de miles, porque tiene que poder volver a parsearse tal cual.
 */
export function centavosAInput(centavos: number): string {
  const abs = Math.abs(centavos);
  return `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

const separadorDeMiles = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Formatea centavos como pesos. Muestra los centavos solo cuando no son cero:
 * `$94.320` pero `$3.333,34`.
 *
 * No es cosmético: es lo que hace que el redondeo se pueda verificar a ojo en la pantalla
 * de saldos, sin ensuciar el resto de los montos con `,00` en todos lados.
 */
export function formatearPesos(centavos: number): string {
  const negativo = centavos < 0;
  const abs = Math.abs(centavos);
  const enteros = Math.floor(abs / 100);
  const resto = abs % 100;

  // La parte decimal se pega a mano desde el entero: dividir por 100 acá volvería a meter
  // un float en el único lugar donde todavía no había ninguno.
  const miles = separadorDeMiles.format(enteros);
  const cuerpo = resto === 0 ? miles : `${miles},${String(resto).padStart(2, "0")}`;

  return `${negativo ? "-" : ""}$${cuerpo}`;
}
