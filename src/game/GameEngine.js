import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import Stats from 'stats.js'
import WorldManager from './WorldManager.js'

export default class GameEngine {
    constructor(canvas) {
        this.targetDirection = null
        this.joystickActive = false

        // Detectar si es móvil para optimizaciones
        this.isMobile = /Mobi|Android/i.test(navigator.userAgent)

        this.stats = new Stats()
        this.stats.showPanel(0)
        this.stats.dom.style.position = 'absolute'
        this.stats.dom.style.top = '10px'
        this.stats.dom.style.right = '10px'
        this.stats.dom.style.left = 'auto'
        this.stats.dom.style.display = 'flex'
        this.stats.dom.style.justifyContent = 'flex-end'
        this.stats.dom.style.width = 'auto'

        document.body.appendChild(this.stats.dom)

        this.canvas = canvas
        this.scene = null
        this.camera = null
        this.renderer = null
        this.world = null
        this.worldManager = null
        this.clock = new THREE.Clock()
        this.animationId = null
        this.smoothedTarget = new THREE.Vector3()

        // Contador de frames para optimizaciones
        this.frameCount = 0

        // Controls
        this.keys = { w: false, a: false, s: false, d: false }

        this.handleKeyDown = this.handleKeyDown.bind(this)
        this.handleKeyUp = this.handleKeyUp.bind(this)
        this.handleResize = this.handleResize.bind(this)
    }

    init() {
        if (this.isMobile) {
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

        // Reducir distancia de fog en móvil
        const fogNear = this.isMobile ? 100 : 150
        const fogFar = this.isMobile ? 250 : 400
        this.scene.fog = new THREE.Fog(0x87CEEB, fogNear, fogFar)

        // Reducir FOV en móvil para mejor rendimiento
        const fov = this.isMobile ? 65 : 75
        this.camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.5, this.isMobile ? 150 : 200)
        this.camera.position.set(0, 5, 11)

        // Configuración optimizada para móvil
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: !this.isMobile, // Sin antialiasing en móvil
            powerPreference: "high-performance",
            stencil: false,
            depth: true,
            alpha: false
        })

        this.renderer.setSize(window.innerWidth, window.innerHeight)

        // Limitar pixel ratio en móvil
        const pixelRatio = this.isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2)
        this.renderer.setPixelRatio(pixelRatio)

        // Configuración de sombras optimizada
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.BasicShadowMap
        this.renderer.shadowMap.autoUpdate = true

        // Optimizaciones adicionales
        this.renderer.physicallyCorrectLights = false
        this.renderer.outputColorSpace = THREE.SRGBColorSpace

        // Configuraciones específicas para móvil
        if (this.isMobile) {
            this.renderer.precision = "mediump"
            this.renderer.logarithmicDepthBuffer = false
        }
    }

    initPhysics() {
        this.world = new CANNON.World()
        this.world.gravity.set(0, -9.82, 0)

        // Configuración optimizada para móvil
        this.world.fixedTimeStep = 1 / 60
        this.world.maxSubSteps = this.isMobile ? 2 : 3 // Menos substeps en móvil

        // Optimizaciones de physics
        this.world.allowSleep = true
        this.world.sleepSpeedLimit = 0.1
        this.world.sleepTimeLimit = 1

        // Broadphase más eficiente
        this.world.broadphase = new CANNON.NaiveBroadphase()
        this.world.broadphase.useBoundingBoxes = true
    }

    initLighting() {
        const ambientIntensity = this.isMobile ? 0.6 : 0.4 // Más luz ambiente en móvil
        const ambientLight = new THREE.AmbientLight(0xffffff, ambientIntensity)
        this.scene.add(ambientLight)

        const directionalIntensity = this.isMobile ? 0.6 : 0.8 // Menos intensidad en móvil
        const directionalLight = new THREE.DirectionalLight(0xffffff, directionalIntensity)
        directionalLight.position.set(10, 20, 10)
        directionalLight.castShadow = true

        // Sombras optimizadas según dispositivo
        const shadowMapSize = 2048
        const shadowCameraFar = this.isMobile ? 60 : 100

        directionalLight.shadow.mapSize.width = shadowMapSize
        directionalLight.shadow.mapSize.height = shadowMapSize
        directionalLight.shadow.camera.near = 0.5
        directionalLight.shadow.camera.far = shadowCameraFar
        directionalLight.shadow.camera.left = -70
        directionalLight.shadow.camera.right = 70
        directionalLight.shadow.camera.top = 70
        directionalLight.shadow.camera.bottom = -70

        // Optimización de sombras para móvil
        if (this.isMobile) {
            directionalLight.shadow.radius = 1
            directionalLight.shadow.blurSamples = 8
        }

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

        // Geometrías con menos segmentos en móvil
        const bodySegments = this.isMobile ? 1 : undefined

        // Car body
        const bodyGeometry = new THREE.BoxGeometry(2, 0.5, 3, bodySegments, bodySegments, bodySegments)
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x030459 })
        const baseMesh = new THREE.Mesh(bodyGeometry, bodyMaterial)
        baseMesh.position.y = 0.25
        baseMesh.castShadow = true
        baseMesh.receiveShadow = true
        carMesh.add(baseMesh)

        // Car roof
        const roofGeometry = new THREE.BoxGeometry(1.6, 0.3, 1.8, bodySegments, bodySegments, bodySegments)
        const roofMesh = new THREE.Mesh(roofGeometry, bodyMaterial)
        roofMesh.position.y = 0.65
        roofMesh.castShadow = true
        carMesh.add(roofMesh)

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

        // Visual wheels con menos segmentos en móvil
        const wheelMeshes = []
        const wheelSegments = this.isMobile ? 8 : 16
        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.4, wheelSegments)
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 })

        vehicle.wheelInfos.forEach(wheel => {
            const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial)
            wheelMesh.rotation.z = Math.PI / 2
            wheelMesh.castShadow = true
            wheelMesh.receiveShadow = true
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
            const targetWorldDir = new THREE.Vector3(
                this.targetDirection.x,
                0,
                this.targetDirection.z
            ).normalize()

            const carQuaternion = new THREE.Quaternion().copy(this.car.body.quaternion)
            const carForward = new THREE.Vector3(0, 0, 1).applyQuaternion(carQuaternion)

            const dotProduct = carForward.dot(targetWorldDir)
            const crossProduct = carForward.clone().cross(targetWorldDir)
            const angle = Math.atan2(crossProduct.y, dotProduct)

            const angleThreshold = Math.PI / 6
            const largeAngleThreshold = Math.PI / 2

            const currentSpeed = this.car.body.velocity.length()
            const isStationary = currentSpeed < 0.5

            if (Math.abs(angle) > largeAngleThreshold) {
                if (isStationary) {
                    const rotationForce = angle > 0 ? 800 : -800
                    this.car.body.angularVelocity.y = rotationForce * 0.02

                    // También dar un pequeño impulso hacia adelante
                    engineForce = -1500
                    steer = 0 // No usar steering cuando rotamos directamente
                } else {
                    steer = angle > 0 ? 0.9 : -0.9
                    engineForce = 0
                }
            } else if (Math.abs(angle) > angleThreshold) {
                // Ángulo mediano: girar fuerte y acelerar poco
                const steerStrength = Math.min(Math.abs(angle) / Math.PI, 1) * 0.9
                steer = angle > 0 ? steerStrength : -steerStrength
                engineForce = -1500 // Acelerar suave
            } else {
                const steerStrength = Math.min(Math.abs(angle) / angleThreshold, 1) * 0.4
                steer = angle > 0 ? steerStrength : -steerStrength
                engineForce = -4000 // Acelerar normal
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

        // Actualizar ruedas (optimizar en móvil)
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

        // Offset optimizado para móvil
        const baseHeight = this.isMobile ? 4 : 5
        const baseDistance = this.isMobile ? 10 : 12
        const cameraOffset = new THREE.Vector3(0, baseHeight, baseDistance)

        const dynamicOffset = cameraOffset.clone()
        const maxSpeedOffset = this.isMobile ? 15 : 25
        dynamicOffset.z += Math.min(speed * 0.1, maxSpeedOffset)

        const targetPos = carPos.clone().add(dynamicOffset)

        // Interpolación más suave en móvil
        const lerpFactor = this.isMobile ? 0.06 : 0.08
        this.camera.position.lerp(targetPos, lerpFactor)
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
                this.targetDirection = {
                    x: dx / dist,
                    z: dy / dist
                }
            } else {
                this.joystickActive = false
                this.targetDirection = null
            }
        }

        // Optimizar eventos touch para mejor rendimiento
        const touchOptions = { passive: true }

        container.addEventListener('touchstart', e => {
            dragging = true
            const touch = e.touches[0]
            startX = touch.clientX
            startY = touch.clientY
        }, touchOptions)

        container.addEventListener('touchmove', e => {
            if (!dragging) return
            e.preventDefault() // Solo prevenir cuando sea necesario
            const touch = e.touches[0]
            handleMove(touch.clientX, touch.clientY)
        })

        container.addEventListener('touchend', () => {
            dragging = false
            joystick.style.transform = 'translate(-50%, -50%)'
            this.joystickActive = false
            this.targetDirection = null
        }, touchOptions)
    }

    setupEventListeners() {
        const keyOptions = { passive: true }
        window.addEventListener('keydown', this.handleKeyDown, keyOptions)
        window.addEventListener('keyup', this.handleKeyUp, keyOptions)
        window.addEventListener('resize', this.handleResize, keyOptions)
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

        this.stats.begin()

        const deltaTime = this.clock.getDelta()

        // Limitar deltaTime para evitar saltos grandes
        const clampedDelta = Math.min(deltaTime, 1 / 30)

        this.world.step(1 / 60, clampedDelta, this.isMobile ? 2 : 3)
        this.updateCar()
        this.worldManager.updateObjects()
        this.updateCamera()
        this.renderer.render(this.scene, this.camera)

        this.stats.end()
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

        this.worldManager.resetObjects()
    }
}