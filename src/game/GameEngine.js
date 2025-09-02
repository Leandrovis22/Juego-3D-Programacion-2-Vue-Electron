import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import WorldManager from './WorldManager.js'

export default class GameEngine {
    constructor(canvas) {

        this.targetDirection = null // Dirección objetivo del joystick
        this.joystickActive = false // Si el joystick está siendo usado

        this.lastFpsUpdate = performance.now()
        this.frameCount = 0

        this.canvas = canvas
        this.scene = null
        this.camera = null
        this.renderer = null
        this.world = null
        this.worldManager = null
        this.clock = new THREE.Clock()
        this.animationId = null
        this.smoothedTarget = new THREE.Vector3()

        // Controls
        this.keys = { w: false, a: false, s: false, d: false }

        this.handleKeyDown = this.handleKeyDown.bind(this)
        this.handleKeyUp = this.handleKeyUp.bind(this)
        this.handleResize = this.handleResize.bind(this)
    }

    init() {
        if (/Mobi|Android/i.test(navigator.userAgent)) {
            this.setupJoystick()
        }

        this.initThreeJS()
        this.initPhysics()
        this.initLighting()
        this.initWorldManager()
        this.initCar()
        this.setupEventListeners()
    }

    initThreeJS() {
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color(0x87CEEB)
        this.scene.fog = new THREE.Fog(0x87CEEB, 150, 400)

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.5, 200)
        this.camera.position.set(0, 5, 11)

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: false,
            powerPreference: "high-performance"
        })
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    }

    initPhysics() {
        this.world = new CANNON.World()
        this.world.gravity.set(0, -9.82, 0)
        this.world.fixedTimeStep = 1 / 60
        this.world.maxSubSteps = 3
    }

    initLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
        this.scene.add(ambientLight)

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(10, 20, 10)
        directionalLight.castShadow = true
        directionalLight.shadow.mapSize.width = 2048
        directionalLight.shadow.mapSize.height = 2048
        directionalLight.shadow.camera.near = 0.5
        directionalLight.shadow.camera.far = 100  // Aumentado de 50 a 100
        directionalLight.shadow.camera.left = -70  // Aumentado de -20 a -50
        directionalLight.shadow.camera.right = 70   // Aumentado de 20 a 50
        directionalLight.shadow.camera.top = 70     // Aumentado de 20 a 50
        directionalLight.shadow.camera.bottom = -70
        this.scene.add(directionalLight)
    }

    initWorldManager() {
        this.worldManager = new WorldManager(this.scene, this.world)
        this.worldManager.initWorld()
        this.worldManager.initObjects()
    }

    initCar() {
        // Visual car group
        const carMesh = new THREE.Group()

        // Car body
        const bodyGeometry = new THREE.BoxGeometry(2, 0.5, 3)
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x030459 })
        const baseMesh = new THREE.Mesh(bodyGeometry, bodyMaterial)
        baseMesh.position.y = 0.25
        carMesh.add(baseMesh)

        // Car roof
        const roofGeometry = new THREE.BoxGeometry(1.6, 0.3, 1.8)
        const roofMesh = new THREE.Mesh(roofGeometry, bodyMaterial)
        roofMesh.position.y = 0.65
        carMesh.add(roofMesh)

        carMesh.castShadow = true
        carMesh.position.set(0, 1, 0)
        carMesh.rotation.y = Math.PI
        this.scene.add(carMesh)

        // Physics chassis
        const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.25, 1.5))
        const chassisBody = new CANNON.Body({ mass: 1000 })
        chassisBody.addShape(chassisShape)
        chassisBody.position.set(0, 1, 0)
        chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI)

        // Vehicle setup
        const vehicle = new CANNON.RaycastVehicle({
            chassisBody: chassisBody,
            indexRightAxis: 0,
            indexUpAxis: 1,
            indexForwardAxis: 2
        })

        const wheelOptions = {
            radius: 0.4,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            axleLocal: new CANNON.Vec3(-1, 0, 0),
            suspensionStiffness: 28,
            suspensionRestLength: 0.3,
            frictionSlip: 5,
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        }

        const halfWidth = 1
        const halfLength = 1.5

        vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(halfWidth, 0, halfLength) })
        vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(-halfWidth, 0, halfLength) })
        vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(halfWidth, 0, -halfLength) })
        vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(-halfWidth, 0, -halfLength) })

        vehicle.addToWorld(this.world)

        // Visual wheels
        const wheelMeshes = []
        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16)
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 })

        vehicle.wheelInfos.forEach(wheel => {
            const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial)
            wheelMesh.rotation.z = Math.PI / 2
            wheelMesh.castShadow = true
            this.scene.add(wheelMesh)
            wheelMeshes.push(wheelMesh)
        })

        this.car = {
            mesh: carMesh,
            body: chassisBody,
            vehicle: vehicle,
            wheels: wheelMeshes,
            initialPosition: new CANNON.Vec3(0, 1, 0),
            initialQuaternion: new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI)
        }
    }

    updateCar() {
        if (!this.car) return

        let steer = 0
        let engineForce = 0

        if (this.joystickActive && this.targetDirection) {
            // Calcular dirección objetivo en el mundo
            const targetWorldDir = new THREE.Vector3(
                this.targetDirection.x,
                0,
                this.targetDirection.z
            ).normalize()

            // Obtener dirección actual del auto
            const carQuaternion = new THREE.Quaternion().copy(this.car.body.quaternion)
            const carForward = new THREE.Vector3(0, 0, 1).applyQuaternion(carQuaternion)

            // Calcular ángulo entre dirección actual y objetivo
            const dotProduct = carForward.dot(targetWorldDir)
            const crossProduct = carForward.clone().cross(targetWorldDir)
            const angle = Math.atan2(crossProduct.y, dotProduct)

            // Aplicar steering basado en el ángulo
            const steerStrength = Math.min(Math.abs(angle) / Math.PI, 1) * 0.8
            steer = angle > 0 ? steerStrength : -steerStrength

            // Siempre acelerar hacia adelante cuando el joystick está activo
            engineForce = -3000

            // Si el ángulo es muy grande (> 90°), retroceder y girar
            if (Math.abs(angle) > Math.PI / 2) {
                engineForce = 2000 // Retroceder
                steer = angle > 0 ? 0.8 : -0.8 // Steering más agresivo
            }

        } else {
            // Controles de teclado normales cuando no hay joystick
            if (this.keys.a) steer = 0.9
            if (this.keys.d) steer = -0.9

            if (this.keys.w) engineForce = -5000
            if (this.keys.s) engineForce = 5000
        }

        // Aplicar controles al vehículo
        this.car.vehicle.setSteeringValue(steer, 0)
        this.car.vehicle.setSteeringValue(steer, 1)
        this.car.vehicle.applyEngineForce(engineForce, 2)
        this.car.vehicle.applyEngineForce(engineForce, 3)

        // Frenos
        if (!this.joystickActive && !this.keys.w && !this.keys.s) {
            this.car.vehicle.setBrake(5, 2)
            this.car.vehicle.setBrake(5, 3)
        } else {
            this.car.vehicle.setBrake(0, 2)
            this.car.vehicle.setBrake(0, 3)
        }

        // Actualizar visuales
        this.car.mesh.position.copy(this.car.body.position)
        this.car.mesh.quaternion.copy(this.car.body.quaternion)

        // Actualizar ruedas
        this.car.vehicle.wheelInfos.forEach((wheel, index) => {
            this.car.vehicle.updateWheelTransform(index)
            const t = wheel.worldTransform
            const wheelMesh = this.car.wheels[index]

            wheelMesh.position.copy(t.position)
            wheelMesh.quaternion.set(t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w)

            const correction = new THREE.Quaternion()
            correction.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
            wheelMesh.quaternion.multiply(correction)
        })
    }

    updateCamera() {
        if (!this.car) return

        const carPos = this.car.mesh.position
        const speed = this.car.body.velocity.length()

        // Offset base (altura y distancia detrás del coche)
        const cameraOffset = new THREE.Vector3(0, 5, 12)

        // Offset dinámico según velocidad
        const dynamicOffset = cameraOffset.clone()
        dynamicOffset.z += Math.min(speed * 0.1, 25)

        // Posición objetivo
        const targetPos = carPos.clone().add(dynamicOffset)

        // Interpolación suave
        this.camera.position.lerp(targetPos, 0.08)
        this.camera.lookAt(carPos)
    }



    setupJoystick() {
        const container = document.getElementById('joystick-container')
        const joystick = document.getElementById('joystick')

        if (!container || !joystick) return

        let dragging = false
        let startX, startY
        const maxDistance = 40

        const handleMove = (x, y) => {
            const dx = x - startX
            const dy = y - startY
            const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDistance)

            const offsetX = dist * Math.cos(Math.atan2(dy, dx))
            const offsetY = dist * Math.sin(Math.atan2(dy, dx))

            joystick.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`

            if (dist > 10) {
                this.joystickActive = true
                // Calcular dirección objetivo en coordenadas del mundo
                // dx positivo = este (+X), dx negativo = oeste (-X)
                // dy negativo = norte (-Z), dy positivo = sur (+Z)
                this.targetDirection = {
                    x: dx / dist, // Normalizado
                    z: dy / dist  // Normalizado (dy positivo = +Z)
                }
            } else {
                this.joystickActive = false
                this.targetDirection = null
            }
        }

        container.addEventListener('touchstart', e => {
            dragging = true
            const touch = e.touches[0]
            startX = touch.clientX
            startY = touch.clientY
        })

        container.addEventListener('touchmove', e => {
            if (!dragging) return
            const touch = e.touches[0]
            handleMove(touch.clientX, touch.clientY)
        })

        container.addEventListener('touchend', () => {
            dragging = false
            joystick.style.transform = 'translate(-50%, -50%)'
            this.joystickActive = false
            this.targetDirection = null
            // No resetear keys aquí, se manejan en updateCar
        })
    }

    setupEventListeners() {
        window.addEventListener('keydown', this.handleKeyDown)
        window.addEventListener('keyup', this.handleKeyUp)
        window.addEventListener('resize', this.handleResize)
    }

    handleKeyDown(event) {
        switch (event.code) {
            case 'KeyW': this.keys.w = true; break
            case 'KeyA': this.keys.a = true; break
            case 'KeyS': this.keys.s = true; break
            case 'KeyD': this.keys.d = true; break
        }
    }

    handleKeyUp(event) {
        switch (event.code) {
            case 'KeyW': this.keys.w = false; break
            case 'KeyA': this.keys.a = false; break
            case 'KeyS': this.keys.s = false; break
            case 'KeyD': this.keys.d = false; break
        }
    }

    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(window.innerWidth, window.innerHeight)
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate())

        const deltaTime = Math.min(this.clock.getDelta(), 1 / 30)
        const frameStart = performance.now()

        this.world.step(1 / 60, deltaTime, 3)
        this.updateCar()
        this.worldManager.updateObjects()
        this.updateCamera()
        this.renderer.render(this.scene, this.camera)

        const frameEnd = performance.now()
        const frameTime = frameEnd - frameStart

        this.frameCount++
        const now = performance.now()
        if (now - this.lastFpsUpdate >= 5000) {
            const fps = (this.frameCount * 1000) / (now - this.lastFpsUpdate)
            console.log(`⏱ Frame: ${frameTime.toFixed(2)} ms | FPS: ${fps.toFixed(1)}`)
            this.frameCount = 0
            this.lastFpsUpdate = now
        }

    }

    start() {
        this.animate()
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId)
        }

        window.removeEventListener('keydown', this.handleKeyDown)
        window.removeEventListener('keyup', this.handleKeyUp)
        window.removeEventListener('resize', this.handleResize)

        if (this.renderer) {
            this.renderer.dispose()
        }

        console.log('GameEngine destroyed')
    }

    resetGame() {
        console.log('🔄 Resetting game...')

        // Reset car
        if (this.car) {
            this.car.body.position.copy(this.car.initialPosition)
            this.car.body.quaternion.copy(this.car.initialQuaternion)
            this.car.body.velocity.setZero()
            this.car.body.angularVelocity.setZero()
        }

        // Reset objects through WorldManager
        this.worldManager.resetObjects()
    }
}