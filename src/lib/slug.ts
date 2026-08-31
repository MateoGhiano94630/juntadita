/**
 * Alfabeto sin caracteres ambiguos: no están 0/O, 1/l/I. El link se dicta en voz alta
 * y se tipea a mano más seguido de lo que uno espera.
 *
 * Son exactamente 32 símbolos a propósito: 256 % 32 === 0, así que tomar `byte % 32`
 * no introduce sesgo de módulo y cada carácter es equiprobable.
 */
const ALFABETO = "123456789abcdefghjkmnpqrstuvwxyz";
const LARGO_SUFIJO = 8;

/**
 * Slug legible + sufijo aleatorio: `asado-del-sabado-k7m2xq4p`.
 *
 * El sufijo es de 8 caracteres, no de 4: el link es el ÚNICO control de acceso de la app
 * (RNF-30, y el riesgo aceptado R-5). 32^8 ≈ 1.1e12 combinaciones cuesta exactamente lo
 * mismo de tipear que 32^4 ≈ 1e6, que sí se puede barrer a fuerza bruta.
 */
export function generarSlug(nombre: string): string {
  const base = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // saca tildes: "Sábado" → "Sabado"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");

  const bytes = new Uint8Array(LARGO_SUFIJO);
  crypto.getRandomValues(bytes);
  const sufijo = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");

  return base ? `${base}-${sufijo}` : `juntada-${sufijo}`;
}
