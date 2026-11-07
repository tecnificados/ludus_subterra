# Ludus Subterra

Ludus Subterra es un juego de mazmorra con cartas para navegador, en español y para una persona. Se ejecuta como una página local: no necesita instalación, servidor ni dependencias externas.

Está basado en **Scoundrel**, el juego de cartas en solitario creado por Zach Gage y Kurt Bieg.

## Cómo jugar

Abre `index.html` en un navegador y pulsa **Comenzar partida** o **Nueva partida**. Empiezas con 20 puntos de vida y una baraja completa de 52 cartas. En cada habitación se muestran cuatro cartas. Al resolver tres, puedes resolver la última en esa habitación o llevarte el objeto/huir del monstruo para que la carta pase a la siguiente. En la última habitación puedes escapar y dejar la carta pendiente atrás. También puedes evitar una habitación completa; no puedes evitar dos habitaciones seguidas.

- **♠ y ♣ — monstruos:** su fuerza equivale al valor de la carta.
- **♦ — armas:** equipar una reemplaza y descarta el arma actual.
- **♥ — pociones:** recuperan vida hasta el máximo de 20; puedes usar varias por habitación.
- **Valores:** 2–10 conservan su número; J=11, Q=12, K=13 y A=14.

Al elegir un monstruo puedes combatir cuerpo a cuerpo o usar un arma si las reglas de combate lo permiten. La interfaz muestra la vida, las cartas restantes de la baraja y las cartas de monstruo vencidas. Consulta [docs/reglas-y-mecanicas.md](docs/reglas-y-mecanicas.md) para las reglas completas, la puntuación y los casos concretos.

## Guardado

Las 10 mejores puntuaciones se guardan en el navegador y se consultan con **HIGH SCORES**, junto al control de música; el panel permite borrarlas. Las victorias muestran una pieza de plata si se dejó un monstruo atrás, o una pieza de oro si se escapó sin dejar enemigos.

La partida se almacena en el `localStorage` del navegador bajo la clave `ludusSubterraSave`; si hay una partida anterior guardada con la clave antigua, se migra al cargar. Usa **Guardar** para guardar manualmente y **Borrar guardado** para eliminar esa copia. El juego también guarda automáticamente al resolver una carta y al terminar la partida. Los datos permanecen en ese navegador y dispositivo.

## Documentación del proyecto

- [Reglas y mecánicas](docs/reglas-y-mecanicas.md): flujo de partida, cartas, combate, puntuación y observaciones de reglas.
- [Implementación y estado](docs/implementacion.md): arquitectura de `index.html`, funciones, estructura del estado y persistencia.

## Estructura

```text
.
├── index.html               # Estructura de la página
├── styles.css               # Estilos y diseño adaptable
├── app.js                   # Reglas, interfaz y control de música
├── midi-player.js           # Reproductor MIDI Web Audio
├── images/                  # Fondo, transiciones, personaje, derrota y victoria
├── audio/                   # Pistas originales y datos locales del reproductor
├── README.md                # Introducción y guía de inicio
└── docs/
    ├── reglas-y-mecanicas.md
    └── implementacion.md
```

La música selecciona una pista MIDI al azar y la repite. Comienza con el primer toque o interacción con la página; el botón **MÚSICA** también puede iniciarla. Después, ese botón permite silenciarla o reactivarla. La atribución aparece en el pie de página.

No hay proceso de compilación. La interfaz está separada en `index.html`, `styles.css` y `app.js`; el audio MIDI está en `midi-player.js` y `audio/`.


