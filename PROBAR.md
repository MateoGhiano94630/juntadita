# Cómo probar esto

Guía para levantarlo, probar el preview de WhatsApp y ponerlo en manos de gente real.

---

## 1. Levantar el proyecto local

Hace falta Node 20 o más nuevo y `pnpm`. Y una base de datos en Neon, que es gratis y tarda dos minutos.

### 1.1 La base

1. Entrá a [neon.com](https://neon.com) y creá una cuenta (el free tier alcanza y sobra).
2. Creá un proyecto. Región: elegí la más cercana, `aws-us-east-2` anda bien desde Argentina.
3. En **Connection Details** copiá la connection string. Se ve así:
   ```
   postgresql://neondb_owner:XXXX@ep-algo-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

> No hace falta Postgres instalado en la máquina. La misma base sirve para local y para producción.
> Si querés separarlas, en Neon creá una *branch* aparte para desarrollo: es una copia instantánea y gratis.

### 1.2 El proyecto

```bash
pnpm install

cp .env.example .env
# Editá .env y pegá tu DATABASE_URL

pnpm db:push      # crea las 5 tablas
pnpm dev          # http://localhost:3000
```

`pnpm db:push` compara el esquema de [src/lib/db/schema.ts](src/lib/db/schema.ts) contra la base y aplica la diferencia. Si querés ver el SQL exacto que genera, está en [drizzle/](drizzle/) y se regenera con `pnpm db:generate`.

### 1.3 Los tests

```bash
pnpm test
```

Son dos, a propósito, y son los dos donde un error se traduce en amigos discutiendo por plata:

- **el reparto suma exactamente el monto** — el redondeo, con un barrido de todos los montos × 1 a 12 personas
- **la suma de todos los saldos da cero** — la invariante, con 200 juntadas pseudoaleatorias de semilla fija

---

## 2. Datos de prueba

```bash
pnpm seed
```

Crea *Asado del sábado* con 8 personas y 6 gastos, y te imprime la URL:

```
  ✓ "Asado del sábado" — 8 personas, 6 gastos, $100020

  http://localhost:3000/j/asado-del-sabado-k7m2xq4p
```

Los gastos del seed están elegidos para cubrir los casos que importan: **$10.000 entre 3** (que no divide exacto) y dos gastos donde no participan todos.

Cada corrida crea una juntada nueva, así que podés correrlo las veces que quieras.

**Para borrar todo y empezar de cero**, en el SQL Editor de Neon:

```sql
-- El orden importa: las FK a participante son RESTRICT a propósito, para que no se
-- pueda borrar a alguien que tiene gastos y quede la juntada descuadrada.
DELETE FROM pago;
DELETE FROM reparto;
DELETE FROM gasto;
DELETE FROM participante;
DELETE FROM juntada;
```

---

## 3. Probar el preview de WhatsApp

**Esto no funciona en localhost.** El crawler de Meta corre en los servidores de Meta y necesita llegar a una URL pública. Si le pasás `localhost:3000` no ve nada.

Hay dos caminos. Para la primera prueba, el túnel. Para probar en serio, el deploy.

### Opción A — Túnel con ngrok (rápido, para iterar)

```bash
# En una terminal, con el dev server corriendo:
npx ngrok http 3000
```

ngrok te devuelve una URL pública tipo `https://a1b2-190-x-x-x.ngrok-free.app`.

**El paso que se olvida siempre:** hay que decirle a la app cuál es su URL pública, o el `og:image` va a salir apuntando a `localhost` y el preview aparece sin imagen.

```bash
# En .env
NEXT_PUBLIC_BASE_URL="https://a1b2-190-x-x-x.ngrok-free.app"
```

Y reiniciá `pnpm dev` (es una variable `NEXT_PUBLIC_`, se hornea en el build).

> ngrok gratis muestra una pantalla intersticial la primera vez que entrás desde un navegador. Al crawler no le afecta, pero a un tester humano sí. Si molesta, usá el deploy.

### Opción B — Deploy real (lo que vas a compartir de verdad)

Ver la sección 4. Es la forma correcta de probar el preview, porque es exactamente lo que va a ver la gente.

### 3.1 Verificar ANTES de mandarle el link a alguien

En orden, de más barato a más caro:

**1. Mirá qué recibe el crawler.** Los crawlers no ejecutan JavaScript: lo que hay en el HTML es todo lo que ven.

```bash
curl -sA "WhatsApp/2.23.20.0 A" https://TU-URL/j/tu-slug | grep -oE '<meta property="og:[^>]*>'
```

Tenés que ver algo así, con datos reales y **URLs absolutas**:

```html
<meta property="og:title" content="Asado del sábado">
<meta property="og:description" content="8 personas · $100.020 gastados. Entrá y cargá el tuyo.">
<meta property="og:image" content="https://TU-URL/api/og/asado-del-sabado-k7m2xq4p?v=1756598400000">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
```

Señales de que algo está mal:
- `og:image` apunta a `localhost` → falta `NEXT_PUBLIC_BASE_URL`
- `og:image` es una ruta relativa (`/api/og/...`) → falta `metadataBase`
- La descripción dice 0 personas o $0 → no está leyendo la base

**2. Abrí la imagen sola en el navegador.** Pegá la URL completa del `og:image`, con el `?v=`. Tenés que ver la placa negra con el nombre, el total y la cantidad de personas. Si tarda más de un segundo, WhatsApp puede cortar el unfurl.

**3. Pasalo por el Sharing Debugger de Meta.**
[developers.facebook.com/tools/debug](https://developers.facebook.com/tools/debug/) → pegá el link → **Debug**.

Te muestra exactamente lo que va a renderizar WhatsApp. Si algo está viejo, **Scrape Again** fuerza a que lo vuelva a leer. Este botón es la única forma confiable de invalidar el caché de Meta.

**4. Recién ahí, mandátelo a vos mismo por WhatsApp.** Mandátelo a tu propio chat, no al grupo.

### 3.2 El caché de WhatsApp, que te va a morder

La imagen se refresca sola: su URL lleva `?v=<timestamp de la última modificación>`, así que cada gasto nuevo genera una URL de imagen distinta.

**Pero WhatsApp cachea el unfurl por URL de página**, y la URL de la juntada no cambia nunca. O sea: si pegás el link, después cargás tres gastos y volvés a pegar el mismo link en el mismo chat, es probable que WhatsApp muestre el preview viejo.

Qué hacer:

- **Para testear:** agregale un parámetro cualquiera al link (`.../j/tu-slug?v=2`). Para WhatsApp es una URL nueva y la vuelve a leer. La app lo ignora.
- **Para invalidar de verdad:** Scrape Again en el Sharing Debugger.
- **En la práctica real, no importa.** El organizador pega el link una vez, al principio, cuando todavía no hay gastos. Lo que valida el experimento es que lo abran, no que el número esté al segundo.

---

## 4. Desplegarlo

### 4.1 Vercel

```bash
# Si todavía no está en GitHub:
git add -A && git commit -m "MVP juntada"
git push
```

1. Entrá a [vercel.com](https://vercel.com) → **Add New** → **Project** → importá el repo.
2. Framework: Next.js (lo detecta solo). No toques nada más.
3. En **Environment Variables**, agregá una sola:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | tu connection string de Neon |

   **No hace falta cargar `NEXT_PUBLIC_BASE_URL`.** En Vercel la app usa `VERCEL_PROJECT_PRODUCTION_URL` sola. Cargala solo si después ponés un dominio propio.

4. **Deploy.**
5. Con la app ya desplegada, corré las migraciones contra la misma base:
   ```bash
   pnpm db:push   # con el DATABASE_URL de producción en tu .env
   ```

### 4.2 Dominio propio (opcional pero recomendado)

Un link `algo.vercel.app` en un grupo de amigos genera desconfianza, y eso te contamina la métrica de tasa de apertura, que es justamente la que estás midiendo.

Si le ponés dominio: Vercel → Settings → Domains, y después agregá `NEXT_PUBLIC_BASE_URL=https://tudominio.com` como variable de entorno y redesplegá.

### 4.3 Antes de mandarlo al primer grupo

- [ ] `pnpm test` pasa
- [ ] Creaste una juntada de prueba en producción y cargaste un gasto
- [ ] El Sharing Debugger muestra el preview con datos reales
- [ ] Abriste el link desde un celular, con datos móviles y no wifi
- [ ] Le mandaste el link a una sola persona de confianza primero

---

## 5. Checklist de prueba manual

Hacelo con dos dispositivos de verdad, no con dos pestañas. Lo que estás probando es el escenario real.

### 5.1 Dos personas, dos dispositivos

- [ ] Abrí la juntada en el celular A. Elegí "Juan" cuando pregunta **¿Quién sos?**
- [ ] Abrí el **mismo link** en el celular B. Tiene que volver a preguntar quién sos (la identidad vive en cada navegador). Elegí "Ana".
- [ ] Desde A cargá un gasto. Desde B, salí de la pestaña y volvé: **el gasto de A tiene que aparecer**.
- [ ] Desde B cargá otro. Volvé a A y verificá que se ve.
- [ ] En cada uno, al abrir "+ Gasto", **"quién puso la plata" tiene que venir preseleccionado con la persona de ese celular**.

### 5.2 Velocidad de carga (requisito duro)

- [ ] Cronometrá cargar un gasto de punta a punta: **menos de 10 segundos**.
- [ ] Contá los toques: **4 como máximo** (+ Gasto → tipear monto → tocar descripción → Confirmar).

Si no entra, el formulario tiene demasiada fricción y hay que simplificarlo. No es negociable.

### 5.3 Un gasto donde no participan todos

- [ ] Cargá "Fernet" $9.600, pagado por Martín, y **destildá a la mitad del grupo**.
- [ ] En la lista tiene que decir `entre 4` (o los que hayas dejado).
- [ ] En **Quién puso qué**, a los destildados no les tiene que haber cambiado el "le toca".

### 5.4 El redondeo: $10.000 entre 3

Este es el caso que rompe las apps mal hechas.

- [ ] Cargá un gasto de **10000**, pagado por **Nico**, tildando solo a **Nico, Sofi y Lu**.
- [ ] En **Quién puso qué**, mirá el "le toca" de los tres:

  | Persona | Le toca | Por qué |
  |---|---|---|
  | Nico (pagó) | **$3.333,34** | el centavo que sobra va al que puso la plata |
  | Sofi | $3.333,33 | |
  | Lu | $3.333,33 | |

- [ ] $3.333,34 + $3.333,33 + $3.333,33 = **$10.000 exactos**. Ni un centavo perdido.
- [ ] Borrá el gasto y volvé a cargarlo idéntico: **tiene que dar exactamente lo mismo**. El reparto es determinístico.

### 5.5 Los saldos cierran en cero

- [ ] Sumá mentalmente la columna de saldos de **Quién puso qué**: los `+` y los `−` se tienen que cancelar exactamente.
- [ ] Andá a **Quién le paga a quién** y tocá **Saldado** en todas las líneas, una por una.
- [ ] Después de la última, todos tienen que decir **"al día"** y la sección tiene que decir *"Está todo saldado"*.
- [ ] Cada pago marcado aparece en **Pagos registrados**. Tocá **Deshacer** en uno: la deuda tiene que volver a aparecer arriba, por el mismo monto.

### 5.6 Alguien que cae de sorpresa

- [ ] Tocá **+ Cayó alguien más** y sumá a "Feli".
- [ ] **Los saldos de los demás no se tienen que mover.** Feli entra en cero.
- [ ] Cargá un gasto nuevo: Feli ya aparece tildado.
- [ ] Los gastos viejos siguen diciendo la misma cantidad de participantes que antes.

### 5.7 Compartir

- [ ] Tocá **Compartir al grupo**. Tiene que decir "¡Copiado!".
- [ ] Pegalo en un chat y leelo **sin abrir el link**: ¿se entiende quién le debe cuánto a quién? Ese es el requisito.
- [ ] Probalo también con la juntada recién creada (sin gastos) y con la juntada toda saldada: el mensaje cambia en los dos casos.

---

## 6. Qué mirar cuando esté con gente real

La hipótesis que se está probando es una sola: **si el organizador pega el link en el grupo, los demás lo abren y cargan sus gastos sin instalar nada ni registrarse.**

Los números que dicen si funcionó:

| Métrica | Umbral | Cómo la medís |
|---|---|---|
| Tasa de apertura del link | > 60% | Preguntale al organizador cuántos son en el grupo, y contá identidades distintas elegidas |
| Invitados que hacen algo | > 40% | Cuántas personas distintas figuran como pagador de al menos un gasto |
| Ciclo completo sin ayuda | 5 grupos | Que hayan llegado a marcar pagos sin que vos les expliques nada |

Si no se cumplen, el problema no es que falten features. Es la propuesta de valor.

Consulta directa a la base para ver cómo va un grupo:

```sql
SELECT j.nombre,
       COUNT(DISTINCT p.id)  AS personas,
       COUNT(DISTINCT g.id)  AS gastos,
       COUNT(DISTINCT g.pagador_id) AS personas_que_cargaron,
       SUM(DISTINCT g.monto_centavos) / 100.0 AS total_pesos
FROM juntada j
LEFT JOIN participante p ON p.juntada_id = j.id
LEFT JOIN gasto g        ON g.juntada_id = j.id
GROUP BY j.id, j.nombre
ORDER BY j.creada_en DESC;
```
