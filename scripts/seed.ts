import "dotenv/config";
import { db } from "../src/lib/db";
import { gastos, juntadas, participantes, repartos } from "../src/lib/db/schema";
import { repartirIgual } from "../src/lib/dominio/reparto";
import { generarSlug } from "../src/lib/slug";
import { urlJuntada } from "../src/lib/url";

/**
 * Datos de prueba para no tener que tipear a mano.
 *
 * Arma un asado con 8 personas y gastos que cubren los casos que importan:
 * un monto que no divide exacto, y gastos donde no participan todos.
 */

const NOMBRES = ["Juan", "Ana", "Nico", "Sofi", "Martín", "Caro", "Feli", "Lu"];

const GASTOS: { descripcion: string; pesos: number; pagador: string; entre: string[] }[] = [
  // $10.000 entre 3 no divide exacto: 3.333,34 / 3.333,33 / 3.333,33.
  { descripcion: "Hielo y carbón", pesos: 10000, pagador: "Nico", entre: ["Nico", "Sofi", "Lu"] },
  { descripcion: "Carne", pesos: 48500, pagador: "Juan", entre: NOMBRES },
  { descripcion: "Bebida", pesos: 18200, pagador: "Ana", entre: NOMBRES },
  // Los que no toman no pagan el fernet.
  { descripcion: "Fernet y coca", pesos: 9600, pagador: "Martín", entre: ["Martín", "Caro", "Feli", "Juan"] },
  { descripcion: "Pan y ensalada", pesos: 7320, pagador: "Sofi", entre: NOMBRES },
  { descripcion: "Postre", pesos: 6400, pagador: "Caro", entre: ["Caro", "Ana", "Lu", "Feli"] },
];

async function main() {
  const nombre = "Asado del sábado";
  const slug = generarSlug(nombre);
  const juntadaId = crypto.randomUUID();

  const gente = NOMBRES.map((n, i) => ({
    id: crypto.randomUUID(),
    juntadaId,
    nombre: n,
    orden: i,
  }));
  const porNombre = new Map(gente.map((p) => [p.nombre, p]));

  await db.batch([
    db.insert(juntadas).values({ id: juntadaId, slug, nombre }),
    db.insert(participantes).values(gente),
  ]);

  for (const g of GASTOS) {
    const gastoId = crypto.randomUUID();
    const montoCentavos = g.pesos * 100;
    const pagador = porNombre.get(g.pagador)!;
    const incluidos = g.entre.map((n) => porNombre.get(n)!);
    const partes = repartirIgual(montoCentavos, incluidos, pagador.id);

    await db.batch([
      db.insert(gastos).values({
        id: gastoId,
        juntadaId,
        descripcion: g.descripcion,
        montoCentavos,
        pagadorId: pagador.id,
      }),
      db.insert(repartos).values(
        partes.map((p) => ({
          gastoId,
          participanteId: p.participanteId,
          montoCentavos: p.montoCentavos,
        })),
      ),
    ]);
  }

  const total = GASTOS.reduce((acc, g) => acc + g.pesos, 0);
  console.log(`\n  ✓ "${nombre}" — ${gente.length} personas, ${GASTOS.length} gastos, $${total}`);
  console.log(`\n  ${urlJuntada(slug)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
