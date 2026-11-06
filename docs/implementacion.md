# Implementación y estado

## Archivos y tecnología

La aplicación se divide en `index.html` (estructura), `styles.css` (presentación), `app.js` (lógica e interfaz de audio) y `midi-player.js` (parser MIDI y síntesis Web Audio). `audio/midi-tracks.js` contiene las pistas codificadas para que el juego funcione al abrir el HTML sin servidor. No hay empaquetador, compilación ni dependencias externas.

El documento está en español (`lang="es"`). La interfaz usa diseño adaptable: a menos de 650 px reorganiza el encabezado, los indicadores y las cartas.

## Organización del HTML

- **Encabezado:** imagen panorámica `images/header.jpg` con capa de contraste, título, botón para silenciar/reactivar música, acceso a HIGH SCORES y botón de reglas.
- **Indicadores:** vida, cartas restantes en la baraja y número de habitación.
- **Inventario:** arma activa, potencia, último monstruo vencido y total de criaturas derrotadas.
- **Habitación:** botones de carta generados desde el estado y progreso de cartas resueltas.
- **Aviso de habitación:** popup accesible de tres segundos al entrar en una habitación nueva; bloquea las cartas hasta que desaparece y anima los fotogramas `images/warrior1.jpg` y `images/warrior2.jpg`; al evitar una habitación muestra `images/scape.jpg`.
- **Código secreto:** al escribir `iddqd` o introducir ↑ ↑ ↓ ↓ ← → ← → B A, `showRaptor()` muestra `images/raptor.jpg` en una capa que bloquea la interfaz durante cuatro segundos.
- **Acciones:** nueva partida, evitar habitación, guardar y borrar guardado.
- **Crónica:** conserva todos los eventos de la partida, con los más recientes primero; al finalizar, el popup muestra el historial completo en una lista desplazable.
- **Paneles superpuestos:** inicio/resultado/ayuda y elección de combate.

Las cartas en la habitación son botones. Los identificadores HTML son consultados con la función `$()` de `app.js`; `render()` vuelve a construir el contenido dinámico y conecta los eventos de selección.

## Reglas y flujo de funciones

- `makeDeck()` construye las 52 cartas y las mezcla con `shuffle()`.
- `startGame()` inicializa el estado, reparte la primera habitación y presenta la partida.
- `fillRoom()` añade cartas hasta llegar a cuatro o agotar la baraja; incrementa el número de habitación si repartió alguna.
- `selectCard()` abre el selector de combate para monstruos y resuelve directamente armas o pociones.
- `resolve()` aplica los efectos de carta y combate; el arma puede sobrevivir, romperse o no ser elegible.
- `removeCard()` retira una carta y actualiza el progreso; tras tres resoluciones abre la decisión de resolver la última carta ahora o posponerla a la siguiente habitación.
- `beginNextRoom()` comprueba muerte/victoria, reinicia el progreso de la habitación y reparte la siguiente.
- `avoidRoom()` devuelve la habitación al fondo de la baraja y avanza. En la última habitación, `deferLastCard()` permite escapar y terminar con victoria dejando la carta pendiente atrás.
- `endGame()` determina puntuación, muestra el resultado y guarda.
- `render()` actualiza interfaz, estado de botones, cartas y registro.
- `save()` y `load()` escriben/leen JSON en almacenamiento local.
- `help()` presenta las reglas rápidas dentro del panel superpuesto.

## Modelo de estado

`state` es un objeto JavaScript serializado como JSON. Campos principales:

| Campo | Significado |
|---|---|
| `deck` | Cartas que aún no han entrado en una habitación; la siguiente se extrae con `shift()`. |
| `room` | Cartas visibles de la habitación, en orden. |
| `hp` | Vida actual, de 0 a 20. |
| `weapon` | Carta de arma equipada o `null`. |
| `weaponDurability` | Puntos de daño que el arma aún puede absorber; empieza con su potencia y disminuye al combatir. |
| `lastMonsterFaced` | Rango, palo y fuerza de la última carta de monstruo combatida; alimenta el indicador de la interfaz. |
| `monstersDefeated` | Monstruos derrotados durante toda la partida; aporta un punto cada uno a la puntuación. |
| `roomsResolved` | Habitaciones completadas sin evitarlas; aporta un punto cada una a la puntuación. |
| `avoided` | Si se evitó la habitación precedente; se restablece al resolver una carta. |
| `roomNo` | Contador de habitaciones repartidas. |
| `resolved` | Cartas resueltas en la habitación actual. |
| `gameOver` | Indica que la partida terminó. |
| `won` | Resultado de la partida. |
| `log` | Historial completo de eventos de la partida, con los más recientes primero. |

Cada carta tiene `s` (palo), `r` (rango), `v` (valor) e `id` (palo concatenado con rango). `pending` contiene temporalmente el índice y la carta de monstruo mientras se espera la decisión de combate; no forma parte del guardado.

## Persistencia y seguridad de renderizado

Las 10 mejores puntuaciones se guardan por separado en `ludusSubterraHighScores` y pueden borrarse desde el panel HIGH SCORES. La clave de partida es `ludusSubterraSave`; `load()` migra datos existentes desde `scoundrelRetroSave` cuando todavía no hay una partida nueva. El crédito de música y el enlace a CC BY 4.0 aparecen en el pie; la copia de la licencia está en `audio/License.txt`. `save()` serializa `state`; `load()` comprueba que el JSON se pueda leer y que `deck` y `room` sean arreglos. También aporta valores predeterminados para algunos campos de partidas anteriores (`monstersDefeated`, `roomsResolved`, `lastMonsterFaced`, `weaponDurability`). Los guardados de versiones anteriores solo conservan las últimas 35 entradas que ya estaban registradas; el historial completo se conserva para las partidas iniciadas con esta versión.

El HTML de mensajes de la crónica pasa por `escapeHTML()`. Los nombres de carta y etiquetas generados por la aplicación proceden de rangos y palos constantes. La ayuda y el panel de fin usan contenido HTML estático más valores numéricos del estado.

## Detalles a tener en cuenta al modificar

- Mantener en sincronía las reglas de `resolve()` en `app.js` y el texto de `help()` / `docs/reglas-y-mecanicas.md`.
- Cambiar la estructura del estado puede requerir ampliar la compatibilidad de `load()`.
- El guardado automático se produce después de retirar una carta y al terminar. **Evitar habitación** no guarda en el acto; guardar manualmente después de esa acción evita perderla si se cierra la pestaña inmediatamente.
- El arma puede usarse contra cualquier monstruo; la durabilidad restante determina si sobrevive o se rompe. El indicador «Último monstruo» usa `lastMonsterFaced` y se actualiza cada vez que se resuelve un combate contra una carta negra.
- `roomsResolved` aumenta cuando se completa una habitación o se pospone su última carta a la siguiente; `avoidRoom()` no lo incrementa. La puntuación es `monstersDefeated + roomsResolved`.
- `roomNo` se incrementa cuando `fillRoom()` reparte cartas; un estado sin cartas no genera una habitación adicional.
- La música elige una de las pistas incluidas al azar y la repite. El botón de cabecera controla el volumen maestro. El navegador puede exigir una interacción antes de permitir audio; el reproductor intenta reanudarse en el primer clic o pulsación de tecla.


