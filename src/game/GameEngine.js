import * as THREE from 'three'
import * as CANNON from 'cannon-es'

export default class GameEngine {
    constructor(canvas) {
        this.canvas = canvas
        this.scene = null
        this.camera = null
        this.renderer = null
        this.world = null
        this.clock = new THREE.Clock()
        this.animationId = null

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
        this.initWorld()
        this.initCar()
        this.initObjects()
        this.setupEventListeners()
    }

    initThreeJS() {
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color(0x87CEEB)

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.5, 200)
        this.camera.position.set(0, 8, 15)

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: false
        })
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.setPixelRatio(2)
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
        directionalLight.shadow.mapSize.width = 1024
        directionalLight.shadow.mapSize.height = 1024
        this.scene.add(directionalLight)
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
            suspensionStiffness: 30,
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
        if (this.keys.a) steer = 0.9
        if (this.keys.d) steer = -0.9

        this.car.vehicle.setSteeringValue(steer, 0)
        this.car.vehicle.setSteeringValue(steer, 1)

        let engineForce = 0
        if (this.keys.w) engineForce = -5000
        if (this.keys.s) engineForce = 5000

        this.car.vehicle.applyEngineForce(engineForce, 2)
        this.car.vehicle.applyEngineForce(engineForce, 3)

        if (!this.keys.w && !this.keys.s) {
            this.car.vehicle.setBrake(5, 2)
            this.car.vehicle.setBrake(5, 3)
        } else {
            this.car.vehicle.setBrake(0, 2)
            this.car.vehicle.setBrake(0, 3)
        }

        // Update chassis visual
        this.car.mesh.position.copy(this.car.body.position)
        this.car.mesh.quaternion.copy(this.car.body.quaternion)

        // Update wheels visual
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

        // Dynamic offset based on speed
        const dynamicOffset = Math.min(speed * 0.1, 25)
        const targetPos = new THREE.Vector3(carPos.x, carPos.y + 8, carPos.z + 15 + dynamicOffset)

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
            const angle = Math.atan2(dy, dx)

            const offsetX = dist * Math.cos(angle)
            const offsetY = dist * Math.sin(angle)

            joystick.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`

            // Reset keys
            this.keys.w = this.keys.a = this.keys.s = this.keys.d = false

            if (dist > 10) {
                if (dy < -10) this.keys.w = true
                if (dy > 10) this.keys.s = true
                if (dx < -10) this.keys.a = true
                if (dx > 10) this.keys.d = true
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
            this.keys.w = this.keys.a = this.keys.s = this.keys.d = false
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

        this.world.step(1 / 60, deltaTime, 3)
        this.updateCar()
        this.updateObjects()
        this.updateCamera()
        this.renderer.render(this.scene, this.camera)
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

    initWorld() {
        // Main island
        const geometry = new THREE.CircleGeometry(50, 32)
        const material = new THREE.MeshLambertMaterial({ color: 0x55aa55 })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.rotation.x = -Math.PI / 2
        mesh.receiveShadow = true
        this.scene.add(mesh)

        // Physics ground
        const shape = new CANNON.Cylinder(50, 20, 1, 32)
        const body = new CANNON.Body({ mass: 0 })
        body.addShape(shape)
        body.position.set(0, -0.5, 0)
        this.world.addBody(body)
    }

    initObjects() {
        // Box at exact position
        const boxGeom = new THREE.BoxGeometry(1, 1, 1)
        const boxMat = new THREE.MeshLambertMaterial({ color: 0xff6b6b })
        const boxMesh = new THREE.Mesh(boxGeom, boxMat)
        boxMesh.position.set(5, 1, 0)
        boxMesh.castShadow = true
        this.scene.add(boxMesh)

        const boxShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5))
        const boxBody = new CANNON.Body({ mass: 1 })
        boxBody.addShape(boxShape)
        boxBody.position.set(5, 1, 0)
        this.world.addBody(boxBody)

        this.box = { mesh: boxMesh, body: boxBody }

        // Sphere at exact position
        const sphereGeom = new THREE.SphereGeometry(1, 16, 16)
        const sphereMat = new THREE.MeshLambertMaterial({ color: 0x4fc3f7 })
        const sphereMesh = new THREE.Mesh(sphereGeom, sphereMat)
        sphereMesh.position.set(-5, 1, 0)
        sphereMesh.castShadow = true
        this.scene.add(sphereMesh)

        const sphereShape = new CANNON.Sphere(1)
        const sphereBody = new CANNON.Body({ mass: 1 })
        sphereBody.addShape(sphereShape)
        sphereBody.position.set(-5, 1, 0)
        this.world.addBody(sphereBody)

        this.sphere = { mesh: sphereMesh, body: sphereBody }
    }

    updateObjects() {
        if (this.box) {
            this.box.mesh.position.copy(this.box.body.position)
            this.box.mesh.quaternion.copy(this.box.body.quaternion)
        }
        if (this.sphere) {
            this.sphere.mesh.position.copy(this.sphere.body.position)
            this.sphere.mesh.quaternion.copy(this.sphere.body.quaternion)
        }
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

        // Reset box
        if (this.box) {
            this.box.body.position.set(5, 1, 0)
            this.box.body.quaternion.set(0, 0, 0, 1)
            this.box.body.velocity.setZero()
            this.box.body.angularVelocity.setZero()
            this.box.body.wakeUp()
        }

        // Reset sphere
        if (this.sphere) {
            this.sphere.body.position.set(-5, 1, 0)
            this.sphere.body.quaternion.set(0, 0, 0, 1)
            this.sphere.body.velocity.setZero()
            this.sphere.body.angularVelocity.setZero()
            this.sphere.body.wakeUp()
        }

        console.log('✅ Game reset complete!')
    }

}