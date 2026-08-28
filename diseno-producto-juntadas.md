# Juntada — Documento de Diseño de Producto

> **Estado:** Descubrimiento / Diseño v1
> **Alcance:** Este documento define *qué* se construye y *por qué*. No define *cómo* (stack, código, esquema de base de datos físico).
> **Nombre del proyecto:** provisorio. Ver §14 Decisiones abiertas.

---

## Índice

1. [Visión y posicionamiento](#1-visión-y-posicionamiento)
2. [Problema y Jobs To Be Done](#2-problema-y-jobs-to-be-done)
3. [Usuarios y roles](#3-usuarios-y-roles)
4. [Principios de producto](#4-principios-de-producto)
5. [Modelo de dominio](#5-modelo-de-dominio)
6. [Casos de uso](#6-casos-de-uso)
7. [Requerimientos funcionales](#7-requerimientos-funcionales)
8. [Reglas de negocio](#8-reglas-de-negocio)
9. [Requerimientos no funcionales](#9-requerimientos-no-funcionales)
10. [Integraciones](#10-integraciones)
11. [Arquitectura conceptual](#11-arquitectura-conceptual)
12. [Métricas](#12-métricas)
13. [Riesgos](#13-riesgos)
14. [Decisiones abiertas](#14-decisiones-abiertas)
15. [Roadmap por fases](#15-roadmap-por-fases)
16. [Fuera de alcance](#16-fuera-de-alcance)

---

## 1. Visión y posicionamiento

### 1.1 Declaración de visión

Ser el **estado compartido de las juntadas**: el objeto vivo, siempre actualizado y sin fricción, que responde "quién viene, quién lleva qué, cuánto va gastado y quién le debe a quién", consumible desde el lugar donde la juntada realmente ocurre: el grupo de WhatsApp.

### 1.2 Posicionamiento

| Dimensión | Definición |
|---|---|
| **Para** | Grupos de amigos, parejas, compañeros de trabajo y familias en Argentina que se juntan seguido y comparten gastos |
| **Que** | Organizan todo por WhatsApp y pierden el hilo de quién puso qué, quién viene y quién debe |
| **Nuestro producto es** | Una web app compartible por link que organiza la juntada y liquida los gastos |
| **Que a diferencia de** | Splitwise (solo divide, sin evento, sin contexto local) y del chat de WhatsApp (sin estado, sin memoria) |
| **Ofrece** | El evento y la plata en un solo objeto, sin que nadie tenga que instalar nada, adaptado a pesos, inflación y billeteras locales |

### 1.3 La apuesta central

Combinamos dos productos que hoy están separados:

- **A — Divisor de gastos.** El foco es la deuda. Usuario ancla: el que puso la tarjeta.
- **B — Organizador de eventos.** El foco es el evento. Usuario ancla: el que organiza.

La hipótesis es que **son la misma persona** (el "tesorero" del grupo) y que unir ambos momentos en un solo objeto es el diferencial. Splitwise no sabe que hubo un asado; el chat no sabe cuánto salió.

### 1.4 Enfoque de entrega: link-first

No es app-first ni bot-first. **El link es el producto.**

Todo estado del sistema tiene que poder existir como un mensaje pegable en WhatsApp, con un preview atractivo, y abrirse en el navegador sin instalación, sin registro y sin login para participar.

---

## 2. Problema y Jobs To Be Done

### 2.1 El problema, en tres capas

**Capa 1 — Coordinación.** "¿Cuándo pueden?" genera 40 mensajes y ninguna respuesta clara. Nadie sabe cuántos son hasta el día anterior. Tres personas traen coca y nadie trae hielo.

**Capa 2 — Registro.** Los gastos ocurren en momentos distintos, en manos distintas, sin ticket. Al final nadie sabe el total real.

**Capa 3 — Liquidación.** Reclamar plata a un amigo es socialmente incómodo. El resultado es que las deudas chicas se perdonan por defecto y siempre pierde el mismo (el que organiza).

### 2.2 Jobs To Be Done

| ID | Job | Situación disparadora |
|---|---|---|
| JTBD-1 | Que el grupo se ponga de acuerdo en una fecha sin que yo persiga a nadie | Quiero organizar algo y arranca la ronda de mensajes |
| JTBD-2 | Que no falte ni sobre nada, sin tener que coordinarlo yo solo | Falta poco para la juntada y no sé qué va a traer cada uno |
| JTBD-3 | Registrar lo que gasté sin romper el momento | Estoy pagando en el super o en el bar con gente esperando |
| JTBD-4 | Saber cuánto me deben sin tener que hacer la cuenta | Terminó la juntada y quedé adelantado |
| JTBD-5 | Que me devuelvan la plata sin que yo tenga que pedirla | Pasaron días y nadie transfirió |
| JTBD-6 | Cerrar el viaje sin discusiones ni planillas | Volvimos y hay 40 gastos en tres monedas |
| JTBD-7 | Guardar lo que sobró para la próxima sin que se diluya | Sobró plata de la vaquita y nadie sabe dónde quedó |

### 2.3 La pregunta de descubrimiento sin responder

Cuando alguien no te devuelve la plata, ¿el problema es que **se olvidó**, que **no sabe cuánto**, o que **te da vergüenza reclamarle**?

- Si es *se olvidó* → el producto es recordatorios.
- Si es *no sabe cuánto* → el producto es cálculo y transparencia.
- Si es *vergüenza* → el producto es despersonalizar el reclamo, y ese es el valor emocional más defendible.

**Esta pregunta debe responderse con entrevistas antes de congelar el MVP.** Ver §15.0.

---

## 3. Usuarios y roles

### 3.1 Personas

**El Tesorero (usuario ancla).** Organiza, adelanta plata, lleva la cuenta en una nota del celular o un Excel. Es el que sufre. Es quien va a instalar, pagar y evangelizar. **Todo el producto se diseña para él.**

**El Participante.** Va a la juntada, pone plata, no quiere instalar nada ni registrarse. Su interacción ideal total: abrir un link, tocar dos cosas, cerrar. Si le pedimos más, no lo hace.

**El Fantasma.** Participa del gasto pero no interactúa con el sistema. El primo, la novia de alguien, el que no tiene el celular a mano. Existe solo como un nombre en la lista de reparto.

### 3.2 Roles en el sistema

| Rol | Permisos |
|---|---|
| **Organizador** | Crea la juntada, edita todo, cierra y liquida, invita, elimina participantes |
| **Participante registrado** | Carga gastos propios, edita gastos propios, confirma pagos recibidos, ve todo |
| **Participante invitado** (sin cuenta) | Confirma asistencia, se apropia de ítems, carga gastos, ve saldos. Identificado por token del link |
| **Fantasma** | Sin acceso. Solo aparece en repartos. Puede ser reclamado por una persona real después |
| **Observador** | Solo lectura por link público. Sin identidad |

**Principio de permisos:** por defecto todos los participantes pueden todo dentro de la juntada, con auditoría visible. El grupo de amigos se autorregula mejor que un sistema de permisos. Solo la eliminación de gastos ajenos y el cierre quedan reservados al organizador.

---

## 4. Principios de producto

Estos principios resuelven empates de diseño. Cuando dos opciones parezcan válidas, gana la que respete el principio de más arriba.

**P1 — Cero fricción para el que no le importa.** Ningún participante debería necesitar cuenta, app ni contraseña. Si una feature obliga a registrarse a los ocho del asado, la feature está mal diseñada.

**P2 — El link es el producto.** Todo estado tiene que existir como mensaje pegable, con preview rico y autoexplicativo. El resumen debe leerse entero en el chat sin abrir nada.

**P3 — La app reclama, no la persona.** El sistema es el cobrador. Todo mensaje sobre plata debe sonar automático e impersonal, nunca como si lo escribiera un amigo.

**P4 — Registrar es más importante que calcular.** Un gasto mal repartido pero cargado vale más que uno perfecto pero olvidado. La velocidad de captura le gana a la precisión.

**P5 — La plata nunca pasa por nosotros.** No custodiamos fondos. Ver §8 RN-11 y §13 R-3.

**P6 — Los números tienen que cerrar siempre.** Cualquier suma de saldos debe dar exactamente cero. Sin excepciones, sin centavos perdidos.

**P7 — Nada se borra en silencio.** Toda edición o eliminación deja rastro visible. Es lo que previene discusiones.

---

## 5. Modelo de dominio

### 5.1 Entidades

**Persona**
Puede existir sin cuenta. Atributos: nombre, identificador opcional (teléfono/email), tipo (registrada / invitada / fantasma), alias de cobro opcional.

**Contexto** *(entidad unificada)*
Contenedor de gastos. Es una sola entidad con un atributo `tipo` que determina su comportamiento:

| Tipo | Duración | Tiene fecha/lugar | Multi-moneda | Casos |
|---|---|---|---|---|
| `JUNTADA` | Efímero (1 día) | Sí | No | Asado, cena, cumple |
| `VIAJE` | Medio (días/semanas) | Rango | Sí | Finde en la costa, Europa |
| `GRUPO` | Permanente | No | No | Los pibes, el depto |

> **Decisión de diseño:** unificar las tres en una sola entidad evita triplicar toda la lógica de gastos, saldos y liquidación. Un `GRUPO` puede contener `JUNTADAS` (relación padre-hijo opcional).

**Participación**
Vincula Persona ↔ Contexto. Atributos: rol, estado de asistencia (invitado / confirmado / rechazado / asistió), fecha de incorporación.

> Importante: la participación tiene fecha. Alguien que se suma el día 3 de un viaje no debe cargar con los gastos del día 1. Ver RN-05.

**Gasto**
Atributos: descripción, monto, moneda, tipo de cambio aplicado, fecha, categoría, quién pagó (uno o varios), método de reparto, comprobante adjunto, estado.

**Reparto**
Cómo se distribuye un gasto entre personas. Métodos soportados: ver RN-01.

**Aporte** *(gasto anticipado)*
Plata que alguien pone *antes* de la juntada a un pozo común. Se distingue del Gasto porque no tiene destino todavía.

**Fondo**
Saldo remanente de un contexto que se transfiere a otro. Es contable, no custodial. Atributos: monto, contexto origen, contexto destino, tenedor designado (la persona que físicamente tiene la plata).

**Saldo**
Derivado, nunca almacenado como verdad. Se recalcula siempre desde gastos + repartos + liquidaciones.

**Liquidación**
Un pago real que cancela deuda. Atributos: de quién, a quién, monto, fecha, método declarado, estado (propuesta / confirmada / rechazada).

**Ítem de aporte** *(qué lleva cada uno)*
Atributos: descripción, cantidad, persona asignada, costo estimado, gasto real vinculado (opcional).

**Evento de auditoría**
Registro inmutable de toda creación, edición y eliminación. Atributos: quién, qué, cuándo, valor anterior, valor nuevo.

### 5.2 Relaciones clave

```
Persona ──< Participación >── Contexto
                                 │
                                 ├──< Gasto ──< Reparto >── Persona
                                 ├──< Aporte >── Persona
                                 ├──< Ítem de aporte >── Persona
                                 ├──< Liquidación >── Persona (x2)
                                 ├──< Evento de auditoría
                                 └──── Fondo ────> Contexto (destino)

Contexto (GRUPO) ──< Contexto (JUNTADA)
```

### 5.3 Nota crítica sobre saldos

El saldo **nunca** se almacena como campo mutable. Se calcula. Un saldo persistido es una fuente garantizada de bugs de descuadre y de conflictos de sincronización offline. Si el rendimiento lo exige más adelante, se cachea con invalidación, pero la verdad siempre es el recálculo.

---

## 6. Casos de uso

### 6.1 Mapa de casos de uso

| ID | Caso de uso | Actor principal | Fase |
|---|---|---|---|
| **ANTES** | | | |
| CU-01 | Crear juntada desde plantilla | Organizador | MVP |
| CU-02 | Invitar por link a WhatsApp | Organizador | MVP |
| CU-03 | Confirmar asistencia sin cuenta | Participante invitado | MVP |
| CU-04 | Acordar fecha por encuesta | Organizador | V1 |
| CU-05 | Armar lista de qué lleva cada uno | Organizador | V1 |
| CU-06 | Apropiarse de un ítem de la lista | Participante | V1 |
| CU-07 | Pedir vaquita anticipada | Organizador | V1 |
| CU-08 | Estimar presupuesto por cabeza | Organizador | V1 |
| **DURANTE** | | | |
| CU-09 | Cargar un gasto | Participante | MVP |
| CU-10 | Repartir un gasto de forma no equitativa | Participante | MVP |
| CU-11 | Adjuntar comprobante | Participante | MVP |
| CU-12 | Cargar gasto sin conexión | Participante | V1 |
| CU-13 | Cargar gasto por voz | Participante | V2 |
| CU-14 | Escanear cuenta y dividir por ítem | Participante | V2 |
| **DESPUÉS** | | | |
| CU-15 | Ver saldos y deudas | Cualquiera | MVP |
| CU-16 | Compartir resumen al grupo | Organizador | MVP |
| CU-17 | Registrar y confirmar un pago | Participante | MVP |
| CU-18 | Cerrar la juntada | Organizador | MVP |
| CU-19 | Dejar el sobrante como fondo | Organizador | V1 |
| CU-20 | Perdonar / redondear una deuda | Acreedor | V1 |
| CU-21 | Netear deudas entre contextos | Cualquiera | V2 |
| CU-22 | Corregir un gasto ya cargado | Participante | MVP |
| CU-23 | Exportar el detalle | Cualquiera | V1 |
| **VIAJES** | | | |
| CU-24 | Crear viaje multi-día | Organizador | V1 |
| CU-25 | Cargar gasto en moneda extranjera | Participante | V1 |
| CU-26 | Sumar a alguien a mitad de viaje | Organizador | V1 |
| CU-27 | Ver resumen visual del viaje | Cualquiera | V2 |

---

### 6.2 Casos de uso detallados

Se detallan los cinco casos críticos. El resto se especifica en el nivel de la tabla anterior más los requerimientos funcionales de §7.

---

#### CU-02 — Invitar por link a WhatsApp

**Actor:** Organizador
**Precondición:** Existe una juntada creada
**Objetivo:** Que los participantes lleguen al estado compartido sin instalar ni registrarse

**Flujo principal**

1. El organizador toca "Invitar al grupo"
2. El sistema genera un link único de la juntada con token de invitación
3. El sistema compone un mensaje formateado para WhatsApp con: nombre de la juntada, fecha, lugar, cantidad de confirmados, presupuesto estimado si existe, y el link
4. El organizador copia el mensaje (un toque) y lo pega en el grupo
5. WhatsApp renderiza el preview del link con la información viva de la juntada
6. Un participante toca el link y accede sin fricción

**Flujos alternativos**

- 4a. El organizador usa el share nativo del sistema operativo y elige WhatsApp directamente
- 6a. El participante ya tiene cuenta → se lo reconoce y se lo asocia automáticamente
- 6b. El participante entra por segunda vez desde otro dispositivo → ver RN-09 (identidad de invitados)

**Postcondición:** Los participantes pueden ver y modificar el estado de la juntada

**Notas de diseño**

- El preview del link es **la parte más importante del caso de uso**. Se genera server-side, se actualiza con el estado real, y debe ser autoexplicativo sin abrir el link.
- El mensaje formateado usa el markdown de WhatsApp (`*negrita*`) y tiene que leerse bien aunque nadie abra el link.
- El link no debe expirar mientras la juntada esté abierta.

---

#### CU-09 — Cargar un gasto

**Actor:** Cualquier participante
**Precondición:** Acceso a la juntada
**Objetivo:** Registrar un gasto en el menor tiempo posible

**Flujo principal**

1. El participante toca "+ Gasto"
2. Ingresa el monto (teclado numérico, foco automático, es el primer y único campo obligatorio)
3. Ingresa la descripción (con sugerencias según la plantilla de la juntada: "Carne", "Bebida", "Carbón")
4. El sistema preselecciona por defecto: pagador = usuario actual, reparto = partes iguales entre todos los confirmados, fecha = hoy, moneda = moneda del contexto
5. El participante confirma
6. El sistema recalcula saldos y notifica al resto

**Flujos alternativos**

- 4a. Cambia el pagador (pagó otro, o pagaron entre varios)
- 4b. Cambia el método de reparto → CU-10
- 4c. Adjunta comprobante → CU-11
- 5a. Sin conexión → CU-12
- 6a. El sistema detecta un gasto muy similar cargado en los últimos minutos → advierte posible duplicado y ofrece ver el existente

**Postcondición:** Gasto registrado, saldos actualizados, evento de auditoría creado

**Requisito de velocidad:** monto + descripción + confirmar debe poder completarse en **menos de 10 segundos** y no más de 4 toques. Este es un requerimiento duro, no una aspiración. Ver P4.

---

#### CU-17 — Registrar y confirmar un pago

**Actor:** Deudor (inicia) y Acreedor (confirma)
**Precondición:** Existe un saldo pendiente entre dos personas
**Objetivo:** Cancelar la deuda sin ambigüedad ni conflicto

**Flujo principal**

1. El deudor ve su deuda y toca "Ya pagué" (o "Pagar")
2. El sistema muestra: monto, a quién, y el alias/CVU del acreedor si está cargado
3. El deudor toca "Copiar alias y abrir billetera" → el sistema copia el alias al portapapeles y abre la app de la billetera
4. El deudor hace la transferencia por fuera del sistema
5. El deudor vuelve y confirma "Ya transferí"
6. El sistema marca la liquidación como **propuesta** y notifica al acreedor
7. El acreedor recibe la notificación y confirma "Me llegó"
8. El sistema marca la liquidación como **confirmada** y actualiza los saldos

**Flujos alternativos**

- 7a. El acreedor rechaza ("No me llegó") → la liquidación vuelve a estado rechazada, se notifica al deudor, la deuda se mantiene
- 7b. El acreedor no responde en X días → el sistema recuerda al acreedor, no al deudor
- 1a. El acreedor inicia: registra directamente "Me pagó" → la liquidación queda confirmada sin necesidad de doble paso (quien cobra no necesita confirmación de sí mismo)
- 3a. No hay alias cargado → el sistema le pide al acreedor que lo cargue, y notifica al deudor cuando esté

**Postcondición:** Deuda cancelada total o parcialmente, con doble registro

**Notas de diseño**

- El doble paso es lo que evita el conflicto. Nunca permitir que el deudor cancele la deuda unilateralmente sin dejar constancia de que falta confirmación.
- Permitir pagos parciales.
- El estado intermedio ("dice que pagó, falta confirmar") debe ser visible para ambos.

---

#### CU-18 — Cerrar la juntada

**Actor:** Organizador
**Precondición:** Juntada con gastos cargados
**Objetivo:** Congelar el estado y disparar la liquidación

**Flujo principal**

1. El organizador toca "Cerrar juntada"
2. El sistema muestra un resumen previo: total gastado, cantidad de gastos, participantes, y saldos finales
3. El sistema calcula la **liquidación mínima** (ver RN-06) y muestra las transferencias sugeridas
4. El organizador revisa y confirma
5. El sistema congela la juntada: los gastos pasan a requerir reapertura para editarse
6. El sistema genera el mensaje de resumen compartible (CU-16)
7. El sistema notifica a cada deudor su monto individual

**Flujos alternativos**

- 3a. El organizador desactiva la simplificación de deudas → se muestran las deudas directas persona a persona
- 4a. Hay sobrante de vaquita → el sistema ofrece devolverlo o dejarlo como fondo (CU-19)
- 5a. Alguien necesita corregir algo después → reapertura con registro de auditoría y notificación a todos

**Postcondición:** Juntada cerrada, liquidaciones pendientes creadas, resumen compartido

---

#### CU-25 — Cargar gasto en moneda extranjera

**Actor:** Participante en un viaje
**Precondición:** Contexto de tipo `VIAJE`
**Objetivo:** Registrar el gasto sin perder información y sin discusiones sobre el tipo de cambio

**Flujo principal**

1. El participante carga un gasto y elige la moneda (distinta a la del viaje)
2. El sistema propone un tipo de cambio de referencia
3. El participante puede aceptarlo o ingresar el que le aplicaron realmente
4. El sistema guarda **los tres datos**: monto original, moneda original, tipo de cambio aplicado
5. Los saldos se calculan en la moneda base del viaje

**Notas de diseño críticas**

- **Nunca guardar solo el monto convertido.** Se pierde la trazabilidad y las discusiones se vuelven irresolubles.
- En Argentina el tipo de cambio no es uno solo. Si dos personas pagaron lo mismo con tarjetas distintas, el costo real es distinto. El sistema debe permitir **tipo de cambio por gasto**, no por viaje.
- Ofrecer configurar un TC por defecto para el viaje, editable en cada gasto.
- La fuente del TC de referencia es una decisión abierta (§14 D-6).

---

## 7. Requerimientos funcionales

Prioridad: **M** = MVP, **1** = V1, **2** = V2, **F** = Futuro

### 7.1 Contextos y participación

| ID | Requerimiento | Pri |
|---|---|---|
| RF-01 | Crear un contexto de tipo juntada, viaje o grupo | M |
| RF-02 | Crear una juntada desde plantilla predefinida (asado, cena, cumple, finde, previa) que precarga categorías, ítems sugeridos y método de reparto | 1 |
| RF-03 | Generar un link de invitación único por contexto | M |
| RF-04 | Acceder y operar en un contexto sin cuenta, identificado por token del link | M |
| RF-05 | Agregar participantes fantasma (solo nombre, sin acceso) | M |
| RF-06 | Confirmar, rechazar o marcar como tentativa la asistencia | M |
| RF-07 | Reclamar un fantasma como identidad propia | 1 |
| RF-08 | Anidar juntadas dentro de un grupo permanente | 1 |
| RF-09 | Sumar un participante con fecha de incorporación posterior al inicio del contexto | 1 |
| RF-10 | Encuesta de fecha con múltiples opciones y voto por participante | 1 |
| RF-11 | Archivar un contexto cerrado sin borrarlo | 1 |
| RF-12 | Salir de un contexto con deuda pendiente (con advertencia y registro) | 1 |
| RF-13 | Rotación de anfitrión: registrar quién organizó las últimas N veces | F |

### 7.2 Gastos

| ID | Requerimiento | Pri |
|---|---|---|
| RF-20 | Cargar un gasto con monto, descripción, pagador, fecha y reparto | M |
| RF-21 | Reparto: partes iguales | M |
| RF-22 | Reparto: por monto fijo por persona | M |
| RF-23 | Reparto: por porcentaje | M |
| RF-24 | Reparto: por shares/ponderación (Juan cuenta 2) | M |
| RF-25 | Excluir personas puntuales de un gasto específico | M |
| RF-26 | Gasto con más de un pagador | 1 |
| RF-27 | Adjuntar foto de comprobante a un gasto | M |
| RF-28 | Editar un gasto existente con registro de auditoría | M |
| RF-29 | Eliminar un gasto (soft delete, visible en auditoría) | M |
| RF-30 | Categorizar gastos | 1 |
| RF-31 | Detectar y advertir posibles gastos duplicados | 1 |
| RF-32 | Cargar gastos sin conexión con sincronización posterior | 1 |
| RF-33 | Cargar un gasto por dictado de voz con interpretación en lenguaje natural | 2 |
| RF-34 | Escanear un ticket y extraer monto y comercio | 2 |
| RF-35 | Escanear una cuenta de restaurante, extraer ítems, y permitir asignación colaborativa en tiempo real | 2 |
| RF-36 | Gastos recurrentes con periodicidad | F |
| RF-37 | Modo rondas para bares | F |
| RF-38 | Gasto privado no visible para el resto | F |

### 7.3 Moneda

| ID | Requerimiento | Pri |
|---|---|---|
| RF-40 | Definir una moneda base por contexto | M |
| RF-41 | Cargar un gasto en moneda distinta a la base, guardando monto original, moneda y TC aplicado | 1 |
| RF-42 | Configurar un TC por defecto por contexto, sobreescribible por gasto | 1 |
| RF-43 | Sugerir un TC de referencia actualizado | 2 |
| RF-44 | Mostrar la antigüedad de una deuda | 1 |
| RF-45 | Ajustar deudas antiguas por inflación (opt-in explícito) | F |

### 7.4 Aportes y fondo

| ID | Requerimiento | Pri |
|---|---|---|
| RF-50 | Solicitar una vaquita anticipada con monto por cabeza y fecha límite | 1 |
| RF-51 | Registrar quién puso su parte de la vaquita | 1 |
| RF-52 | Ver el estado de la vaquita (cuánto se juntó, quién falta) | 1 |
| RF-53 | Convertir el sobrante de un contexto en fondo | 1 |
| RF-54 | Designar tenedor del fondo (quién tiene físicamente la plata) | 1 |
| RF-55 | Aplicar un fondo existente como crédito inicial de un nuevo contexto | 1 |
| RF-56 | Ver el historial de movimientos de un fondo | 1 |

### 7.5 Ítems y organización

| ID | Requerimiento | Pri |
|---|---|---|
| RF-60 | Crear una lista de ítems para la juntada | 1 |
| RF-61 | Apropiarse de un ítem de la lista | 1 |
| RF-62 | Asignar costo estimado a un ítem | 1 |
| RF-63 | Convertir un ítem cumplido en gasto real con un toque | 1 |
| RF-64 | Estimar presupuesto por cabeza a partir de los ítems | 1 |
| RF-65 | Definir lugar y hora de la juntada | M |
| RF-66 | Calculadora de cantidades (carne, bebida, hielo, carbón por persona) | 2 |

### 7.6 Saldos y liquidación

| ID | Requerimiento | Pri |
|---|---|---|
| RF-70 | Calcular el saldo de cada participante en tiempo real | M |
| RF-71 | Mostrar quién le debe a quién, en deudas directas | M |
| RF-72 | Calcular la liquidación mínima (simplificación de deudas) | M |
| RF-73 | Activar o desactivar la simplificación de deudas | 1 |
| RF-74 | Registrar una liquidación como propuesta por el deudor | M |
| RF-75 | Confirmar o rechazar una liquidación como acreedor | M |
| RF-76 | Registrar liquidaciones parciales | 1 |
| RF-77 | Perdonar o redondear una deuda (solo el acreedor) | 1 |
| RF-78 | Cerrar un contexto y congelar los gastos | M |
| RF-79 | Reabrir un contexto cerrado con registro y notificación | 1 |
| RF-80 | Netear deudas de una misma persona entre contextos distintos | 2 |
| RF-81 | Guardar alias/CVU de cobro por persona | M |

### 7.7 Compartir y notificar

| ID | Requerimiento | Pri |
|---|---|---|
| RF-90 | Generar mensaje formateado para WhatsApp de: invitación, estado, resumen final, deuda individual | M |
| RF-91 | Copiar el mensaje al portapapeles con un toque | M |
| RF-92 | Compartir vía share nativo del sistema operativo | M |
| RF-93 | Preview enriquecido del link (Open Graph) con estado vivo del contexto | M |
| RF-94 | Recordatorio automático a deudores con tono impersonal | 1 |
| RF-95 | Recordatorio de vaquita pendiente antes de la fecha límite | 1 |
| RF-96 | Notificación al acreedor cuando hay una liquidación pendiente de confirmar | M |
| RF-97 | Configurar frecuencia y silenciar recordatorios | 1 |
| RF-98 | Generar resumen visual compartible del viaje o del año (imagen) | 2 |
| RF-99 | Exportar el detalle completo a CSV | 1 |
| RF-100 | Recibir un gasto compartido desde otra app (share target) | 2 |

### 7.8 Cuentas y datos

| ID | Requerimiento | Pri |
|---|---|---|
| RF-110 | Registrarse con teléfono o email | M |
| RF-111 | Convertir una identidad de invitado en cuenta registrada, conservando el historial | 1 |
| RF-112 | Ver el historial de todos los contextos propios | 1 |
| RF-113 | Ver el log de auditoría de un contexto | 1 |
| RF-114 | Exportar todos los datos personales | 1 |
| RF-115 | Eliminar la cuenta y los datos personales | 1 |
| RF-116 | Estadísticas del grupo (cuánto gastamos, cuántas veces nos juntamos) | 2 |

---

## 8. Reglas de negocio

Estas reglas son la parte más importante del documento. Un error acá se traduce en descuadres y en discusiones entre usuarios.

### RN-01 — Métodos de reparto

Un gasto se reparte por exactamente uno de estos métodos:

| Método | Definición | Validación |
|---|---|---|
| `IGUAL` | Monto ÷ cantidad de participantes incluidos | Al menos un participante incluido |
| `MONTO_FIJO` | Cada persona tiene un monto explícito | La suma debe ser exactamente igual al total |
| `PORCENTAJE` | Cada persona tiene un % | La suma debe ser exactamente 100% |
| `SHARES` | Cada persona tiene una ponderación entera | La suma de shares debe ser > 0 |

Un gasto siempre almacena el reparto **resuelto en montos absolutos**, aunque se haya definido por porcentaje o shares. Esto evita recálculos inconsistentes si cambia el grupo después.

### RN-02 — Redondeo

Regla obligatoria: **la suma de los repartos debe ser exactamente igual al monto del gasto.**

Procedimiento:
1. Se calcula el reparto en la unidad mínima de la moneda (centavos).
2. Se trunca hacia abajo cada parte.
3. La diferencia residual (siempre menor a la cantidad de participantes, en centavos) se distribuye de a una unidad, empezando por el pagador y siguiendo por orden estable de incorporación al contexto.

El orden debe ser **determinístico y estable** para que dos recálculos den siempre el mismo resultado.

### RN-03 — Cálculo de saldo

```
saldo(persona) = Σ(lo que pagó) − Σ(lo que le corresponde) + Σ(liquidaciones recibidas confirmadas) − Σ(liquidaciones pagadas confirmadas)
```

- Saldo positivo → le deben
- Saldo negativo → debe
- **Invariante:** Σ(saldos de todos los participantes) = 0, siempre y exactamente

Las liquidaciones en estado *propuesta* **no** afectan el saldo. Solo se muestran como estado informativo.

### RN-04 — Participación por defecto en un gasto

Al crear un gasto, se incluyen por defecto:

- En `JUNTADA`: los participantes con asistencia confirmada
- En `VIAJE`: los participantes activos en la fecha del gasto (ver RN-05)
- En `GRUPO`: todos los miembros activos

### RN-05 — Incorporación tardía

Una persona solo participa de los gastos cuya fecha sea **igual o posterior** a su fecha de incorporación al contexto. Los gastos anteriores no la incluyen y no se recalculan retroactivamente.

Excepción: se puede incluir manualmente en un gasto anterior (caso: alguien pagó la seña del Airbnb antes de que otro se sumara pero el otro igual se beneficia).

### RN-06 — Simplificación de deudas

Con la simplificación activa, el sistema calcula el conjunto mínimo de transferencias que salda todos los saldos.

Restricciones:
- La simplificación **nunca** puede crear una transferencia hacia alguien que ya está saldado
- El resultado debe ser determinístico (ante empates, ordenar por criterio estable)
- Debe poder desactivarse, porque hay grupos que prefieren pagarle directamente a quien le deben antes que a un tercero

Advertencia de producto: la simplificación es matemáticamente óptima pero socialmente puede ser rara ("¿por qué le tengo que transferir a Ana si yo comí con Pedro?"). Por eso es configurable.

### RN-07 — Doble confirmación de pago

Una liquidación tiene tres estados: `PROPUESTA` → `CONFIRMADA` | `RECHAZADA`.

- Si la inicia el **deudor**, nace como `PROPUESTA` y requiere confirmación del acreedor
- Si la inicia el **acreedor**, nace directamente como `CONFIRMADA`
- Solo las `CONFIRMADAS` afectan el saldo

### RN-08 — Auditoría

Toda operación de creación, modificación o eliminación sobre gastos, repartos, liquidaciones y participantes genera un evento inmutable con: actor, timestamp, entidad, valor anterior, valor nuevo.

Los gastos se eliminan con soft delete. Nada desaparece de la historia.

### RN-09 — Identidad de invitados

Un invitado se identifica por un token persistido en su dispositivo, asociado al link de invitación.

- Si abre el link desde otro dispositivo, el sistema le pregunta quién es y le ofrece la lista de participantes existentes para reclamar su identidad
- Si reclama una identidad ya reclamada desde otro dispositivo, se advierte y se requiere confirmación de un participante ya activo
- **Riesgo aceptado:** este modelo es débil desde el punto de vista de seguridad. Es una decisión deliberada a favor de P1 (cero fricción). No se manejan datos sensibles ni plata real, y el contexto es un grupo de confianza. Ver §13 R-5.

### RN-10 — Cierre y reapertura

- Un contexto cerrado no admite nuevos gastos ni ediciones
- Solo el organizador puede reabrirlo
- Toda reapertura notifica a todos los participantes y queda en auditoría
- Las liquidaciones ya confirmadas **no** se revierten al reabrir

### RN-11 — No custodia de fondos

**El sistema nunca recibe, retiene ni transfiere dinero.**

- Los aportes a la vaquita se registran como declaraciones, no como transacciones
- El fondo es un saldo contable con un **tenedor designado** que físicamente tiene la plata
- Las liquidaciones son registros de transferencias que ocurrieron por fuera

Esta regla no es una preferencia técnica: custodiar fondos de terceros en Argentina implica encuadrarse como proveedor de servicios de pago con registro ante el BCRA, requisitos de encaje, KYC y prevención de lavado. Es un negocio distinto. Ver §13 R-3.

### RN-12 — Precisión numérica

Todos los montos se manejan en **enteros de la unidad mínima de la moneda** (centavos). Nunca en punto flotante. Esta regla no admite excepciones.

---

## 9. Requerimientos no funcionales

### 9.1 Rendimiento

| ID | Requerimiento |
|---|---|
| RNF-01 | La carga de un gasto (monto + descripción + confirmar) debe completarse en menos de 10 segundos y máximo 4 toques |
| RNF-02 | El link de invitación debe renderizar contenido visible en menos de 2 segundos en 3G |
| RNF-03 | El recálculo de saldos de un contexto con 200 gastos y 20 participantes debe ser imperceptible (<200ms) |
| RNF-04 | El preview del link (Open Graph) debe generarse en menos de 1 segundo para no romper el unfurl de WhatsApp |

### 9.2 Disponibilidad y offline

| ID | Requerimiento |
|---|---|
| RNF-10 | La carga de gastos debe funcionar sin conexión y sincronizar al recuperarla |
| RNF-11 | Ante conflicto de sincronización, ninguna operación se pierde: los gastos son aditivos por naturaleza y no deben sobrescribirse |
| RNF-12 | La app debe ser instalable como PWA |

### 9.3 Usabilidad

| ID | Requerimiento |
|---|---|
| RNF-20 | Todo el flujo del participante invitado debe ser operable sin registro y sin instalación |
| RNF-21 | Interfaz optimizada para uso con una mano, de pie, con poca luz y prisa |
| RNF-22 | Los montos deben ser legibles a distancia (tipografía grande en las cifras clave) |
| RNF-23 | Español rioplatense en toda la interfaz. Nada de "recibo" ni "billetera electrónica": ticket, plata, alias, vaquita |
| RNF-24 | El resumen compartible debe ser comprensible leyéndolo en WhatsApp, sin abrir el link |

### 9.4 Seguridad y privacidad

| ID | Requerimiento |
|---|---|
| RNF-30 | Los links de invitación deben usar tokens no adivinables |
| RNF-31 | Cumplimiento de la Ley 25.326 de Protección de Datos Personales (Argentina) |
| RNF-32 | Los comprobantes adjuntos son accesibles solo por participantes del contexto |
| RNF-33 | Ningún dato bancario sensible se almacena más allá del alias/CVU declarado voluntariamente |
| RNF-34 | Derecho de exportación y eliminación de datos personales, con efecto en menos de 30 días |

### 9.5 Escalabilidad y operación

| ID | Requerimiento |
|---|---|
| RNF-40 | La arquitectura debe permitir migrar de web a mobile nativo sin rediseñar el modelo de datos |
| RNF-41 | Costos de infraestructura por usuario activo cercanos a cero en la fase de validación |
| RNF-42 | Toda integración externa debe ser desacoplable: el producto tiene que funcionar completo si se cae cualquier proveedor |

---

## 10. Integraciones

### 10.1 Matriz de integraciones

| Integración | Valor | Complejidad | Riesgo | Fase |
|---|---|---|---|---|
| WhatsApp (copiar-pegar + Open Graph) | Muy alto | Muy baja | Nulo | **MVP** |
| Share nativo del SO | Alto | Muy baja | Nulo | **MVP** |
| Copiar alias + abrir billetera | Alto | Muy baja | Nulo | **MVP** |
| Calendario (ICS) | Medio | Baja | Nulo | V1 |
| OCR de tickets | Alto | Media | Bajo | V2 |
| Voz → gasto (LLM) | Alto | Media | Bajo | V2 |
| Mercado Pago (link de pago) | Bajo | Media | Medio | Evaluar |
| MODO / QR interoperable | Medio | Alta | Medio | Investigar |
| WhatsApp Bot 1:1 (Cloud API) | Medio | Alta | Alto | V2+ |
| WhatsApp Bot en grupo | Bajo | Alta | Muy alto | Descartado por ahora |

### 10.2 WhatsApp — la integración principal

**Nivel 1 (MVP): copiar-pegar.**
Sin API, sin costo, sin riesgo. El sistema genera mensajes formateados y el humano los pega. Captura la mayor parte del valor.

Piezas necesarias:
- Composición de mensajes con markdown de WhatsApp (`*negrita*`, `_cursiva_`)
- Botón de copiado en un toque
- Share nativo del SO
- **Open Graph server-side con estado vivo.** Esta es la pieza crítica. El preview del link tiene que mostrar información real y actualizada. Un preview genérico mata la tasa de clicks.

**Nivel 2 (V2): share target.**
La PWA se registra como destino de compartir. Alguien saca foto del ticket, la comparte a la app, y queda pre-cargada.

**Nivel 3 (evaluar): bot 1:1 vía Cloud API.**
El bot es el *teclado* (input conversacional rápido), el link es la *pantalla*. Nunca al revés: el chat es pésimo para mostrar estado.

Restricciones a considerar antes de comprometerse:
- Meta modifica el esquema de precios de la Business API en octubre de 2026, cobrando por mensaje fuera de la ventana de sesión. **Verificar el impacto exacto antes de diseñar sobre esto.**
- Con ingreso por usuario cercano a cero, el costo por mensaje puede volver el modelo inviable
- Las APIs no oficiales (tipo Whapi) tienen riesgo de baneo del número

**Nivel 4: bot en grupo. Descartado en esta etapa.**
Meta habilitó grupos en la Cloud API, pero: límites bajos de agregado programático de miembros, costo multiplicado por participante, y fricción social alta (meter un número desconocido en un grupo de amigos). Reevaluar solo con usuarios que lo pidan y con números que lo justifiquen.

### 10.3 Pagos — el análisis honesto

**Mercado Pago no tiene una API de transferencias entre personas.** Su plataforma de desarrolladores está construida alrededor del cobro comercial: preferencias de checkout, links de pago, QR de comercio, webhooks de notificación. Todo modelado como vendedor → comprador.

Consecuencias para nuestro caso:

| Opción | Problema |
|---|---|
| Link de pago vía API | El acreedor recibe la plata como comercio. Comisión + posible demora de acreditación. Pagar comisión para que un amigo te devuelva $12.000 es inaceptable |
| Deep link a la app de MP | No documentado oficialmente, se rompe con actualizaciones |
| Marketplace con split | Requiere habilitación como marketplace, otro nivel de complejidad y requisitos |

**Decisión para MVP: no integrar pagos.**

En su lugar: guardar el alias/CVU de cada persona, y un botón "Copiar alias y abrir billetera". Cero integración, cero comisión, funciona con cualquier banco o billetera del país.

Esto además sirve como **experimento**: mide si la gente realmente quiere pagar desde nuestra app o si ya paga cómodamente desde la suya. Si el copiar-pegar tiene alta adopción, la integración profunda no agrega valor y no vale su costo.

**A investigar en paralelo:** MODO y el ecosistema de QR interoperable / Transferencias 3.0. Es un camino nativamente P2P y, a priori, más adecuado que el checkout comercial de MP. Requiere investigación de viabilidad: condiciones de acceso a la API, costos y requisitos de habilitación.

### 10.4 Otras integraciones

**Calendario (ICS).** Generar un archivo de evento descargable. Trivial de implementar, alto valor percibido. V1.

**OCR de tickets.** Con modelos de visión actuales, extraer monto, comercio y fecha de una foto de ticket es viable con buena precisión. La extracción de ítems línea por línea (para CU-14) es más difícil pero alcanzable. Requiere prototipo de validación antes de comprometer alcance.

**Voz → gasto.** "Puse doce lucas en la carne" → gasto estructurado. Los LLMs actuales lo resuelven bien, incluyendo modismos locales ("luca", "gamba", "palo"). Es el input más rápido posible.

**Mapas.** Ubicación de la juntada y cálculo de distancia para dividir nafta y peaje en viajes. V2.

**Principio transversal (RNF-42):** ninguna integración puede ser un punto único de falla. Si se cae el OCR, se carga a mano. Si se cae el TC de referencia, se ingresa manualmente.

---

## 11. Arquitectura conceptual

> Sin decisiones de stack. Solo la forma del sistema y las restricciones que la forma impone.

### 11.1 Capas

```
┌─────────────────────────────────────────────────┐
│  CAPA DE DISTRIBUCIÓN                           │
│  WhatsApp · Share nativo · (futuro: bot)        │
│  El link, el mensaje formateado, el preview     │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│  CAPA DE PRESENTACIÓN                           │
│  PWA responsive, mobile-first, offline-capable  │
│  Vistas: pública (sin auth) y privada           │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│  CAPA DE DOMINIO                                │
│  Reparto · Redondeo · Saldos · Netting          │
│  Estados de liquidación · Auditoría             │
│  ⚠ Debe ser independiente de UI y de storage    │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│  CAPA DE PERSISTENCIA                           │
│  Contextos · Gastos · Repartos · Liquidaciones  │
│  Eventos de auditoría (append-only)             │
└─────────────────────────────────────────────────┘

        ┌────────────────────────────────┐
        │  SERVICIOS EXTERNOS            │
        │  Todos opcionales y            │
        │  desacoplables (RNF-42)        │
        └────────────────────────────────┘
```

### 11.2 Restricciones arquitectónicas

**A1 — Motor de dominio aislado.** Toda la lógica de reparto, redondeo, saldos y liquidación vive en un módulo puro, sin dependencias de framework, UI ni base de datos. Es lo que permite migrar a mobile nativo (RNF-40) reutilizando la parte más delicada y mejor testeada del sistema.

**A2 — Renderizado del preview en el servidor.** El Open Graph tiene que resolverse server-side. Los crawlers de WhatsApp no ejecutan JavaScript.

**A3 — Auditoría append-only.** El log de eventos es inmutable y se escribe siempre, en la misma transacción que la operación que registra.

**A4 — Saldos derivados, nunca persistidos.** Ver §5.3.

**A5 — Diseño offline-aware desde el modelo, no como parche.** Los gastos son aditivos, lo que hace la sincronización tratable. Las ediciones y eliminaciones son la parte difícil: necesitan resolución explícita de conflictos definida desde el principio.

**A6 — Dos superficies de acceso.** Vista pública por token (sin sesión) y vista privada autenticada. Comparten dominio pero tienen reglas de acceso distintas. Definirlo desde el inicio, no adaptarlo después.

### 11.3 Modelo de datos conceptual

```
CONTEXTO
  id · tipo · nombre · fecha_inicio · fecha_fin · lugar
  moneda_base · tc_default · estado (abierto/cerrado/archivado)
  contexto_padre_id · simplificacion_activa

PERSONA
  id · nombre · tipo (registrada/invitada/fantasma)
  identificador (tel/email) · alias_cobro

PARTICIPACION
  contexto_id · persona_id · rol
  estado_asistencia · fecha_incorporacion · token_acceso

GASTO
  id · contexto_id · descripcion · monto_centavos
  moneda · tc_aplicado · fecha · categoria
  estado (activo/eliminado) · comprobante_url
  metodo_reparto

PAGADOR_GASTO
  gasto_id · persona_id · monto_centavos

REPARTO
  gasto_id · persona_id · monto_centavos      ← siempre resuelto en absoluto

APORTE
  contexto_id · persona_id · monto_centavos · fecha · confirmado

FONDO
  id · contexto_origen_id · contexto_destino_id
  monto_centavos · tenedor_persona_id · estado

LIQUIDACION
  id · contexto_id · deudor_id · acreedor_id
  monto_centavos · fecha · metodo_declarado
  estado (propuesta/confirmada/rechazada)
  iniciada_por_id

ITEM
  contexto_id · descripcion · cantidad
  persona_asignada_id · costo_estimado_centavos · gasto_id

EVENTO_AUDITORIA
  contexto_id · actor_id · timestamp · tipo_operacion
  entidad · entidad_id · valor_anterior · valor_nuevo
```

---

## 12. Métricas

### 12.1 Métrica norte

**Juntadas liquidadas por usuario ancla por trimestre.**

Mide el ciclo completo: se creó, se usó, se cerró y se cobró. Una juntada creada y abandonada no vale nada.

### 12.2 Métricas por etapa del embudo

| Etapa | Métrica | Por qué importa |
|---|---|---|
| **Distribución** | Tasa de apertura del link pegado en el grupo | Valida P2. Es *la* hipótesis del producto |
| **Activación** | % de invitados que hacen al menos una acción | Valida P1. Si entran y no tocan nada, el problema es la propuesta de valor |
| **Captura** | Gastos por juntada · tiempo mediano de carga | Valida P4 |
| **Liquidación** | % de deudas confirmadas a 7 y 30 días | Es el resultado que la gente quiere |
| **Retención** | % de tesoreros que crean una segunda juntada en 90 días | El problema estructural del producto (ver §13 R-1) |
| **Viralidad** | Invitados que después se vuelven tesoreros | El único crecimiento sostenible |

### 12.3 Anti-métricas

Cosas que **no** hay que optimizar:

- Tiempo en la app. Menos es mejor.
- Cantidad de notificaciones enviadas. Una app que reclama demasiado se desinstala.
- Registros totales. Un invitado que nunca se registra pero usa el producto es un éxito, no una pérdida.

---

## 13. Riesgos

### R-1 — Frecuencia de uso baja (riesgo principal)

Una juntada se organiza una vez por mes en el mejor caso. Sin uso frecuente no hay hábito, sin hábito no hay retención, y el producto se olvida entre usos.

**Mitigaciones:**
- El **fondo común** es el mecanismo más fuerte: plata guardada que obliga a volver
- Grupos permanentes y gastos recurrentes dan frecuencia semanal
- Viajes largos generan uso diario concentrado
- El resumen del año / estadísticas del grupo da una razón de reapertura pasiva

**Este riesgo determina la priorización del fondo común por encima de otras features aparentemente más urgentes.**

### R-2 — Dependencia de plataforma

Todo el modelo de distribución depende del comportamiento de WhatsApp: previews de link, políticas, precios de API.

**Mitigación:** la estrategia link-first no usa ninguna API de WhatsApp. Funciona con copiar-pegar, que ninguna plataforma puede quitar. Es deliberadamente la opción de menor dependencia.

### R-3 — Riesgo regulatorio del fondo

Si el fondo pasa de contable a custodial, el proyecto se convierte en un proveedor de servicios de pago sujeto a regulación del BCRA.

**Mitigación:** RN-11 es una restricción de diseño, no una preferencia. El fondo tiene tenedor humano designado. Si se valida demanda de custodia real, se evalúa alianza con una entidad ya habilitada, nunca implementación propia.

### R-4 — Competencia de Splitwise

Es un producto maduro, gratuito y conocido.

**Mitigación / diferenciación:** el evento (Splitwise no organiza nada), la localización (pesos, inflación, alias, billeteras locales, modismos), y el fondo común (nadie lo tiene bien resuelto). Nuestro foco es el momento social completo, no la contabilidad.

### R-5 — Seguridad débil del modelo de invitados

El acceso por token de link es vulnerable a que alguien comparta el link fuera del grupo.

**Riesgo aceptado deliberadamente.** No se manejan fondos ni datos sensibles. El costo de una autenticación fuerte (perder P1) es mayor que el daño potencial. Mitigaciones parciales: tokens no adivinables, posibilidad de revocar el link, y advertencia al reclamar una identidad ya activa.

### R-6 — Alcance excesivo

El documento describe un producto grande. Construirlo entero antes de validar es la forma más común de fracasar.

**Mitigación:** el roadmap de §15 es incremental y cada fase tiene un criterio de éxito explícito. No se avanza de fase sin cumplirlo.

---

## 14. Decisiones abiertas

| ID | Decisión | Opciones | Impacto |
|---|---|---|---|
| D-1 | Nombre y dominio | — | Marketing, no bloquea el diseño |
| D-2 | ¿El GRUPO permanente entra en V1 o en V2? | V1 da retención antes / V2 simplifica el MVP | Alcance |
| D-3 | ¿Simplificación de deudas activa por defecto? | Sí (óptimo) / No (más intuitivo) | UX. Resolver con usuarios reales |
| D-4 | Modelo de negocio | Freemium (viajes ilimitados pagos) / donación / gratis con costo mínimo | No urgente, pero condiciona el techo de gasto en APIs |
| D-5 | ¿Identidad por teléfono o por email? | Teléfono es más natural en el contexto pero más caro de verificar | Onboarding |
| D-6 | Fuente del tipo de cambio de referencia | API pública / carga manual / sin sugerencia | Viajes |
| D-7 | ¿Se puede eliminar un gasto o solo anular? | Soft delete visible / anulación explícita | Auditoría y confianza |
| D-8 | ¿PWA pura o mobile nativo después? | PWA cubre casi todo; nativo mejora cámara, offline y notificaciones | A decidir después de validar |
| D-9 | ¿Vale la pena el bot 1:1 dado el costo por mensaje? | Depende de números que todavía no tenemos | Requiere investigación de costos |

---

## 15. Roadmap por fases

### Fase 0 — Validación sin construir (1 a 2 semanas)

**No se escribe una línea de código.**

- 8 a 12 entrevistas con tesoreros identificados
- Responder la pregunta central de §2.3 (olvido / desconocimiento / vergüenza)
- Mago de Oz: llevar la cuenta de 2 o 3 juntadas reales con planilla y WhatsApp, a mano
- Validar el interés por el fondo común, que es la feature de mayor riesgo y mayor retorno

**Criterio de avance:** identificar el dolor dominante y confirmar que el tesorero existe como figura reconocible en la mayoría de los grupos.

---

### Fase 1 — MVP: el link que se pega (4 a 6 semanas)

**Hipótesis a validar:** *si un tesorero pega el link en el grupo, los demás lo abren y lo usan sin instalar nada.*

**Alcance:** todos los requerimientos marcados **M**.

Crear juntada · invitar por link · confirmar sin cuenta · cargar gastos con los cuatro métodos de reparto · adjuntar comprobante · ver saldos · liquidación mínima · doble confirmación de pago · alias de cobro · cerrar · mensajes formateados y preview vivo.

**Fuera del MVP:** viajes, fondo, vaquita, ítems, encuesta de fecha, plantillas, offline, multi-moneda, OCR, voz, cualquier integración de pago.

**Criterio de éxito:**
- Tasa de apertura del link pegado en el grupo > 60%
- Al menos un 40% de los invitados realiza una acción
- 5 grupos completan el ciclo entero sin asistencia del equipo

**Si el criterio no se cumple:** el problema no es de features, es de la propuesta de valor. Volver a Fase 0.

---

### Fase 2 — V1: retención (6 a 8 semanas)

**Hipótesis a validar:** *el fondo común y los viajes generan una segunda y tercera vuelta.*

**Alcance:** requerimientos marcados **1**.

Viajes multi-día y multi-moneda · fondo común · vaquita anticipada · lista de ítems · plantillas · encuesta de fecha · offline · recordatorios automáticos · perdonar deuda · exportación · grupos permanentes (según D-2).

**Criterio de éxito:** más del 30% de los tesoreros crea una segunda juntada dentro de los 90 días.

---

### Fase 3 — V2: el momento wow (8 a 10 semanas)

**Hipótesis a validar:** *la captura sin fricción y el resumen compartible generan crecimiento orgánico.*

**Alcance:** requerimientos marcados **2**.

Carga por voz · OCR de tickets · división por ítem colaborativa · resumen visual compartible · netting entre contextos · calculadora de asado (como gancho de adquisición) · share target · estadísticas del grupo.

**Criterio de éxito:** invitados que se convierten en tesoreros de sus propios grupos, sin adquisición pagada.

---

### Fase 4 — Exploración

Bot 1:1 · mobile nativo · gastos recurrentes · integraciones de pago si se validaron · modelo de negocio.

---

## 16. Fuera de alcance

Explícitamente **no** hacemos, y la decisión de no hacerlo es parte del diseño:

- **Custodiar dinero.** RN-11. No negociable en esta etapa.
- **Chat propio.** WhatsApp gana. No competimos.
- **Red social.** No hay feed, no hay seguidores, no hay perfil público.
- **Gestión de gastos personales.** No somos una app de finanzas personales.
- **Reserva o pago de servicios** (restaurantes, alojamientos, entradas).
- **Sistema de reputación público de pagadores.** Socialmente tóxico y legalmente riesgoso.
- **Bot en grupo de WhatsApp.** Descartado para las fases 1 a 3. Ver §10.2.

---

## Cómo usar este documento

- Los **requerimientos funcionales (§7)** son la unidad de trabajo. Cada uno debería poder convertirse en tickets sin ambigüedad.
- Las **reglas de negocio (§8)** son la especificación del motor de dominio y deben tener cobertura de tests exhaustiva. Un error acá se traduce en descuadres y en discusiones entre usuarios reales.
- Las **decisiones abiertas (§14)** deben cerrarse antes de la fase que las requiere, no antes.
- Los **criterios de éxito de cada fase (§15)** son condiciones de avance, no aspiraciones. Si no se cumplen, la respuesta correcta es volver atrás, no seguir agregando features.
