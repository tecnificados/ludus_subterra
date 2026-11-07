# Reglas y mecánicas

Ludus Subterra está basado en **Scoundrel**, juego de cartas en solitario creado por Zach Gage y Kurt Bieg.

Este documento describe el comportamiento implementado en `app.js`; sirve como referencia de la versión actual.

## Baraja

La baraja incluye los cuatro palos y todos los rangos del 2 al A: 52 cartas en total.

| Palo | Tipo | Cartas | Cantidad |
|---|---|---|---:|
| ♠ | Monstruo | 2–10, J, Q, K, A | 13 |
| ♣ | Monstruo | 2–10, J, Q, K, A | 13 |
| ♦ | Arma | 2–10, J, Q, K, A | 13 |
| ♥ | Poción | 2–10, J, Q, K, A | 13 |

Los valores son 2–10 y J=11, Q=12, K=13, A=14. La baraja se mezcla mediante Fisher–Yates.

## Preparación y habitaciones

Una partida nueva crea una baraja mezclada, 20 de vida, sin arma, sin cartas en la habitación y contadores a cero. Se roban hasta cuatro cartas para formar la primera habitación.

En cada habitación se muestran hasta cuatro cartas. Al resolver tres, si queda una carta puedes resolverla en esa habitación o posponerla: un objeto te acompaña y un monstruo te persigue; la carta pendiente pasa a la siguiente habitación junto con cartas de la baraja hasta completar cuatro. Si eliges resolverla ahora, se aplican sus efectos normales (usar objeto o combatir al monstruo). Las cartas resueltas se retiran del juego. Si quedan menos de cuatro cartas disponibles, la última habitación puede tener menos de cuatro; se termina cuando no quedan cartas ni en la habitación ni en la baraja.

Se puede evitar la habitación solo antes de resolver ninguna carta, cuando hay cuatro cartas y no se ha evitado ya la habitación precedente. Evitarla devuelve sus cuatro cartas al fondo de la baraja en el mismo orden en que estaban y roba una nueva habitación. Resolver una carta vuelve a habilitar la opción de evitar en la habitación posterior.

## Monstruos y combate

Al seleccionar un monstruo aparece un diálogo con su fuerza y las opciones de combate. En combate cuerpo a cuerpo se recibe todo el daño de su valor.

La potencia y la durabilidad inicial de un arma equivalen al valor de su carta. La durabilidad representa cuántos puntos de daño puede absorber antes de romperse y se muestra en el indicador **DAÑO RESTANTE**. Con un arma equipada:

1. **Monstruo más débil que la durabilidad restante:** puedes usar el arma contra cualquier monstruo cuya fuerza sea menor que la durabilidad actual. El arma lo derrota sin daño a la vida y pierde tantos puntos de durabilidad como la fuerza del monstruo. Por ejemplo, un arma con 4 puntos restantes puede vencer a un monstruo de fuerza 2 y quedarse con 2.
2. **Monstruo con fuerza igual o superior a la durabilidad restante:** puedes usar el arma; absorbe toda la durabilidad restante y se rompe. Pierdes la diferencia entre la fuerza del monstruo y la durabilidad restante. Por ejemplo, un arma con 6 puntos frente a un monstruo de 10 se rompe y causa 4 puntos de daño a la vida. Una igualdad rompe el arma y causa cero daño.

No hay restricción por los monstruos derrotados anteriormente: la elección depende de la durabilidad restante. Un arma nueva empieza con durabilidad igual a su potencia; equipar otra descarta la anterior. El combate cuerpo a cuerpo no desgasta el arma. El inventario muestra las cartas de monstruo derrotadas durante la partida.

Cada monstruo retirado incrementa el contador de criaturas derrotadas, tanto si se vence con arma como en combate cuerpo a cuerpo. El contador persiste entre habitaciones y armas.

## Armas, pociones y vida

- Al resolver un diamante se equipa esa arma, se descarta cualquier arma anterior y se elimina la carta de la habitación. Las figuras y el as de diamantes son armas de potencia y durabilidad inicial 11–14.
- Al resolver un corazón, se recupera su valor en vida sin superar 20. Las figuras y el as de corazones recuperan 11–14 puntos, hasta el máximo de 20. Se pueden usar todas las pociones que aparezcan en la habitación; cada una se consume al resolverla.
- La vida no baja de cero. Llegar a cero termina la partida inmediatamente y cierra cualquier decisión pendiente de la habitación.

## Final y puntuación

La victoria ocurre cuando se vacían tanto la habitación como la baraja, o cuando se escapa desde la decisión de la última carta. La puntuación se calcula igual al ganar o perder:

**Puntuación = monstruos derrotados + habitaciones resueltas**

Una habitación cuenta como resuelta al completar sus tres elecciones (o al retirar todas sus cartas si quedan menos de tres). En la última habitación, cuando no quedan cartas en la baraja, puedes escapar dejando atrás la carta restante; la partida termina como victoria. Si dejas atrás un monstruo, la victoria queda marcada con una pieza de plata; si no queda ningún enemigo, con una pieza de oro. Las habitaciones evitadas no cuentan. La puntuación nunca puede ser negativa. El resultado muestra ambos contadores y la puntuación final.

## Interfaz y controles

- **Nueva partida / Jugar otra vez:** inicia una partida desde cero.
- **¿Cómo se juega?:** muestra el resumen de reglas. Si hay una partida activa, el botón **Volver al juego** cierra el panel.
- **Escapar:** botón situado en el indicador de habitación; devuelve la habitación al fondo de la baraja cuando se cumplen las condiciones anteriores. Cuando queda una carta tras resolver tres, puedes resolverla ahora o llevarte el objeto/huir del monstruo para continuar con esa carta en la siguiente habitación.
- **Guardar:** almacena el estado actual en el navegador.
- **Borrar guardado:** elimina la copia local; no borra el estado de la partida que está en pantalla.
- **Cambio de habitación:** muestra durante tres segundos una animación con `images/warrior1.jpg` y `images/warrior2.jpg`.
- **Resultado:** muestra `images/warrior_happy.jpg` al ganar y `images/death.jpg` al perder.
- **Crónica:** conserva todos los eventos de la partida, con los más recientes primero, e indica la vida y la durabilidad del arma tras cada acción. Al terminar, el historial completo aparece dentro del popup final.

Al cargar la página se intenta restaurar el guardado. Si no hay uno válido, se muestra el panel de inicio. Una partida restaurada se reanuda sin el panel de inicio.

## Observaciones para futuras consultas

- La puntuación suma los monstruos derrotados y las habitaciones resueltas; las habitaciones evitadas no suman. En partidas guardadas anteriores a este contador, `roomsResolved` se inicializa en 0 porque ese dato no se almacenaba.
- Evitar una habitación llama a la transición de habitación y actualiza el estado visual, pero esa acción no llama directamente al guardado automático. Se conserva al pulsar **Guardar** o cuando una carta se resuelve posteriormente.
- La interfaz muestra los naipes restantes sobre 52 con una barra de progreso y lista los rangos y palos de los monstruos vencidos.
- El historial ya no se recorta: se conserva completo y el popup de fin permite recorrerlo con desplazamiento.
- El estado se guarda por navegador; no hay cuenta, sincronización entre dispositivos ni almacenamiento de servidor.

