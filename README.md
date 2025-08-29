Juego de fisicas en 3D hecho con Vue y Electrón

Es un proyecto de simulación física en 3D desarrollado con Electron, Vue 3, Three.js y Cannon-es. Permite controlar un vehículo en un entorno con física realista, incluyendo cajas, botellas, conos y puentes, todo renderizado en 3D. Este proyecto se realizó como parte del Trabajo Práctico Integrador (TPI) de Programación 2.

🛠 Tecnologías

Electron: Para crear la aplicación de escritorio multiplataforma.

Vue 3 + Vite: Para la interfaz de usuario y gestión de componentes.

Three.js: Renderizado 3D en tiempo real.

Cannon-es: Motor de física para simulación de cuerpos rígidos y vehículos.

ESLint + Prettier: Para mantener código limpio y consistente.

🚀 Características

Vehículo con ruedas controlable mediante teclado (W, A, S, D).

Física realista de cuerpos rígidos: colisiones, gravedad y suspensión del vehículo.

Entorno 3D con islas, puentes, cajas, botellas y conos.

Cámara dinámica que sigue al vehículo con suavizado.

Soporte para sombras y luces direccionales.

Reinicio de juego con posición inicial de todos los objetos.

Optimización de física con SAPBroadphase y cuerpos en reposo (allowSleep).

🎮 Controles

W → Acelerar

S → Frenar / retroceder

A → Girar a la izquierda

D → Girar a la derecha

Redimensionar ventana → Ajuste automático de cámara y render

💻 Instalación

Clonar el repositorio,

Instalar dependencias:

npm install


Ejecutar en modo desarrollo:

npm run electron:dev


Esto levantará Vite para la interfaz y lanzará Electron con la aplicación de escritorio.

🔨 Scripts disponibles

npm run dev → Ejecuta solo Vite (interfaz Vue).

npm run electron → Ejecuta Electron apuntando a la aplicación construida.

npm run electron:dev → Desarrollo completo con Vite + Electron.

npm run build → Construye la aplicación para producción (Vue + Electron).

🧩 Estructura del proyecto
juego-3d/
├─ electron/          # Archivos principales de Electron
│  └─ main.js 
├─ src/               # Código fuente Vue + Three.js
│  └─ App.vue
│  └─ main.js
│  └─ game/GameEngine.js           # Lógica de motor de juego (GameEngine.js)
├─ package.json
├─ index.html
├─ vite.config.js
└─ README.md

⚙️ Optimización y buenas prácticas

Broadphase de física optimizado con SAPBroadphase.

Objetos estáticos en reposo (allowSleep) para reducir cálculos innecesarios.

Uso de geometrías simplificadas para objetos pequeños (conos, botellas, cajas).

Shadows limitados solo a objetos importantes para mejorar FPS.

DeltaTime limitado y clamped en el loop de animación para estabilidad de física.