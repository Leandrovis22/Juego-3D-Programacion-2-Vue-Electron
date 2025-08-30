<template>
  <div id="app">
    <canvas ref="gameCanvas" class="game-canvas"></canvas>
    <div class="ui-overlay">
      <div class="controls-info">
        <p>WASD - Mover auto</p>
      </div>
    </div>
    <div id="joystick-container">
      <div id="joystick"></div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import GameEngine from './game/GameEngine.js'

export default {
  name: 'App',
  setup() {
    const gameCanvas = ref(null)
    let gameEngine = null

    onMounted(() => {
      gameEngine = new GameEngine(gameCanvas.value)
      gameEngine.init()
      gameEngine.start()

      // Crear botón reinicio
      const restartBtn = document.createElement('button')
      restartBtn.innerText = 'Reiniciar'
      restartBtn.style.position = 'absolute'
      restartBtn.style.top = '25px'
      restartBtn.style.left = '180px'
      restartBtn.style.padding = '10px'
      restartBtn.style.zIndex = 100
      document.body.appendChild(restartBtn)

      restartBtn.addEventListener('click', () => gameEngine.resetGame())
    })

    onUnmounted(() => {
      if (gameEngine) {
        gameEngine.destroy()
      }
    })

    return {
      gameCanvas
    }
  }
}
</script>
<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  background: #00000000;
}

.game-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.ui-overlay {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 15px;
  border-radius: 8px;
  font-family: Arial, sans-serif;
  z-index: 100;
}

.controls-info h3 {
  margin-bottom: 10px;
  color: #4CAF50;
}

.controls-info p {
  margin: 5px 0;
  font-size: 14px;
}

#joystick-container {
  position: absolute;
  bottom: 30px;
  left: 30px;
  width: 120px;
  height: 120px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 50%;
  touch-action: none;
}

#joystick {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 60px;
  height: 60px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

/* Por defecto visible */
#joystick-container {
  display: block;
}

/* En pantallas grandes lo ocultamos */
@media (min-width: 1024px) {
  #joystick-container {
    display: none;
  }
}
</style>
