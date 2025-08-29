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

        // Controles
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false
        }

        // Referencias a objetos del juego
        this.car = null
        this.ground = null
        this.groundBody = null
        this.boxes = []
        this.bottles = []

        // Bind methods to preserve 'this' context
        this.handleKeyDown = this.handleKeyDown.bind(this)
        this.handleKeyUp = this.handleKeyUp.bind(this)
        this.handleResize = this.handleResize.bind(this)
    }

    init() {
        if (/Mobi|Android/i.test(navigator.userAgent)) {
            this.setupJoystick()
        }
        console.log('Initializing GameEngine...')
        try {
            this.initThreeJS()
            console.log('Three.js initialized')
            this.initPhysics()
            console.log('Physics initialized')
            this.initLighting()
            console.log('Lighting initialized')
            this.initGround()
            console.log('Ground initialized')
            this.initCar()
            console.log('Car initialized')
            this.initTestObjects()
            console.log('Test objects initialized')
            this.setupControls()
            console.log('Controls initialized')
            this.setupEventListeners()
            console.log('Event listeners initialized')
        } catch (error) {
            console.error('Error initializing GameEngine:', error)
        }
    }

    setupJoystick() {
        const container = document.getElementById('joystick-container')
        const joystick = document.getElementById('joystick')

        let dragging = false
        let startX, startY

        const maxDistance = 40 // hasta dónde se puede mover el stick

        const handleMove = (x, y) => {
            const dx = x - startX
            const dy = y - startY
            const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDistance)

            const angle = Math.atan2(dy, dx)

            const offsetX = dist * Math.cos(angle)
            const offsetY = dist * Math.sin(angle)

            joystick.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`

            // reset
            this.keys.w = this.keys.a = this.keys.s = this.keys.d = false

            if (dist > 10) { // zona muerta

                // 🚗 Aceleración
                if (dy < -10) this.keys.w = true       // hacia arriba = acelerar
                if (dy > 10) this.keys.s = true       // hacia abajo = reversa

                // 🚗 Dirección (se puede combinar con w/s)
                if (dx < -10) this.keys.a = true       // izquierda
                if (dx > 10) this.keys.d = true       // derecha
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


    initThreeJS() {
        console.log('Canvas element:', this.canvas)

        // Scene
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color(0x87CEEB) // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200)

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
        // Set initial camera position explicitly
        this.camera.position.set(0, 5, 10)
        this.camera.lookAt(0, 0, 0)

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true
        })

        console.log('WebGL Renderer created:', this.renderer)
        console.log('WebGL Context:', this.renderer.getContext())

        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
        this.renderer.physicallyCorrectLights = true

        console.log('Renderer size set to:', window.innerWidth, 'x', window.innerHeight)
        console.log('Initial camera position:', this.camera.position)
    }

    initPhysics() {
        this.world = new CANNON.World()
        this.world.gravity.set(0, -9.82, 0)

        // Usar broadphase simple
        this.world.broadphase = new CANNON.SAPBroadphase(this.world)
        this.world.broadphase.axisIndex = 2 // Z-axis


        // Configuración básica del solver
        this.world.solver.iterations = 10
        this.world.solver.tolerance = 0.01

        // Set fixed timestep for stability
        this.world.fixedTimeStep = 1.0 / 60.0
        this.world.maxSubSteps = 3

        // Material básico
        this.defaultMaterial = new CANNON.Material('default')
        this.world.defaultContactMaterial.friction = 0.4
        this.world.defaultContactMaterial.restitution = 0.3

        console.log('Physics world initialized - basic setup')
    }

    initLighting() {
        // Luz ambiental
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
        this.scene.add(ambientLight)

        // Luz direccional (sol)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(10, 20, 10)
        directionalLight.castShadow = true
        directionalLight.shadow.mapSize.width = 2048
        directionalLight.shadow.mapSize.height = 2048
        directionalLight.shadow.camera.near = 0.5
        directionalLight.shadow.camera.far = 50
        directionalLight.shadow.camera.left = -20
        directionalLight.shadow.camera.right = 20
        directionalLight.shadow.camera.top = 20
        directionalLight.shadow.camera.bottom = -20
        this.scene.add(directionalLight)
    }

    initGround() {
        // --- Visual ---
        const groundRadius = 30
        const groundGeometry = new THREE.CircleGeometry(groundRadius, 64)
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x55aa55 })
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial)
        this.ground.rotation.x = -Math.PI / 2
        this.ground.position.set(0, 0, 0)
        this.ground.receiveShadow = true
        this.scene.add(this.ground)

        // Isla secundaria (igual ya la tienes coherente con 20)
        const islandRadius = 20
        const islandGeometry = new THREE.CircleGeometry(islandRadius, 64)
        const islandMaterial = new THREE.MeshLambertMaterial({ color: 0x559955 })
        this.island = new THREE.Mesh(islandGeometry, islandMaterial)
        this.island.rotation.x = -Math.PI / 2
        this.island.position.set(0, 0, -80)
        this.island.receiveShadow = true
        this.scene.add(this.island)

        // --- Físicas (hacer coincidir radios) ---
        const groundShape = new CANNON.Cylinder(groundRadius, groundRadius, 1, 32)
        this.groundBody = new CANNON.Body({ mass: 0, material: this.defaultMaterial })
        this.groundBody.addShape(groundShape)
        this.groundBody.position.set(0, -0.5, 0) // altura = 1 → superficie en y=0
        this.world.addBody(this.groundBody)

        const islandShape = new CANNON.Cylinder(islandRadius, islandRadius, 1, 32)
        this.islandBody = new CANNON.Body({ mass: 0, material: this.defaultMaterial })
        this.islandBody.addShape(islandShape)
        this.islandBody.position.set(0, -0.5, -80)
        this.world.addBody(this.islandBody)

        // 🌉 Puente doble (dos tablones en paralelo)
        this.bridgePlanks = []
        const numPlanks = 2          // cantidad de secciones
        const plankWidth = 1
        const plankLength = 20
        const separation = 1         // separación lateral entre los dos planos

        // 👉 posición base del puente
        const bridgeBaseX = 0
        const bridgeBaseY = 0.2
        const bridgeBaseZ = -37      // solo cambias esto y mueves todo el puente

        for (let i = 0; i < numPlanks; i++) {
            const z = bridgeBaseZ - i * plankLength

            // 🔹 Pasarela izquierda
            const geometryL = new THREE.BoxGeometry(plankWidth, 0.2, plankLength)
            const materialL = new THREE.MeshLambertMaterial({ color: 0x8B4513 })
            const meshL = new THREE.Mesh(geometryL, materialL)
            meshL.castShadow = true
            meshL.receiveShadow = true
            meshL.position.set(bridgeBaseX - separation, bridgeBaseY, z)
            this.scene.add(meshL)

            const shapeL = new CANNON.Box(new CANNON.Vec3(plankWidth / 2, 0.1, plankLength / 2))
            const bodyL = new CANNON.Body({ mass: 0, material: this.defaultMaterial })
            bodyL.addShape(shapeL)
            bodyL.position.set(bridgeBaseX - separation, bridgeBaseY, z)
            this.world.addBody(bodyL)

            this.bridgePlanks.push({ mesh: meshL, body: bodyL })

            // 🔹 Pasarela derecha
            const geometryR = new THREE.BoxGeometry(plankWidth, 0.2, plankLength)
            const materialR = new THREE.MeshLambertMaterial({ color: 0x8B4513 })
            const meshR = new THREE.Mesh(geometryR, materialR)
            meshR.castShadow = true
            meshR.receiveShadow = true
            meshR.position.set(bridgeBaseX + separation, bridgeBaseY, z)
            this.scene.add(meshR)

            const shapeR = new CANNON.Box(new CANNON.Vec3(plankWidth / 2, 0.1, plankLength / 2))
            const bodyR = new CANNON.Body({ mass: 0, material: this.defaultMaterial })
            bodyR.addShape(shapeR)
            bodyR.position.set(bridgeBaseX + separation, bridgeBaseY, z)
            this.world.addBody(bodyR)

            this.bridgePlanks.push({ mesh: meshR, body: bodyR })
        }



        console.log("Isla principal, isla secundaria y puente creados")
    }


    initCar() {
        const carWidth = 2;    // ancho del auto
        const carHeight = 0.5; // altura del chasis
        const carLength = 3;   // largo del auto
        const mass = 1000;

        // -------------------
        // Chasis visual
        // -------------------
        const carMesh = new THREE.Group();

        // Base del auto
        const baseGeometry = new THREE.BoxGeometry(carWidth, carHeight, carLength);
        const baseMaterial = new THREE.MeshLambertMaterial({ color: 0x030459 });
        const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
        baseMesh.position.y = carHeight / 2;
        carMesh.add(baseMesh);

        // Techo
        const roofGeometry = new THREE.BoxGeometry(carWidth * 0.8, carHeight * 0.6, carLength * 0.6);
        const roofMesh = new THREE.Mesh(roofGeometry, baseMaterial);
        roofMesh.position.y = carHeight + 0.3;
        carMesh.add(roofMesh);

        carMesh.castShadow = true;
        carMesh.position.set(0, 1, 0);

        // Rotar visual 180° en Y
        carMesh.rotation.y = Math.PI;

        this.scene.add(carMesh);

        // -------------------
        // Chasis físico
        // -------------------
        const chassisShape = new CANNON.Box(new CANNON.Vec3(carWidth / 2, carHeight / 2, carLength / 2));
        const chassisBody = new CANNON.Body({ mass });
        chassisBody.addShape(chassisShape);
        chassisBody.position.set(0, 1, 0);

        // Rotar físico 180° en Y
        chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);

        // -------------------
        // Vehículo con ruedas
        // -------------------
        const options = {
            chassisBody: chassisBody,
            indexRightAxis: 0,  // x
            indexUpAxis: 1,     // y
            indexForwardAxis: 2 // z
        };
        const vehicle = new CANNON.RaycastVehicle(options);

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
        };

        const halfWidth = carWidth / 2;
        const halfLength = carLength / 2;

        vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(halfWidth, 0, halfLength) });
        vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(-halfWidth, 0, halfLength) });
        vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(halfWidth, 0, -halfLength) });
        vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(-halfWidth, 0, -halfLength) });

        vehicle.addToWorld(this.world);

        // -------------------
        // Visual de ruedas
        // -------------------
        const wheelMeshes = [];
        vehicle.wheelInfos.forEach(wheel => {
            const wheelGeometry = new THREE.CylinderGeometry(wheel.radius, wheel.radius, 0.4, 16);
            const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
            const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);

            // Orientar el cilindro
            wheelMesh.rotation.z = Math.PI / 2;
            wheelMesh.castShadow = true;
            this.scene.add(wheelMesh);
            wheelMeshes.push(wheelMesh);
        });

        // -------------------
        // Guardar referencias
        // -------------------
        this.car = {
            mesh: carMesh,
            body: chassisBody,
            vehicle: vehicle,
            wheels: wheelMeshes
        };
    }


    initTestObjects() {
        // Apilado de cajas
        for (let i = 0; i < 5; i++) {         // número de columnas
            for (let j = 0; j < 5; j++) {     // altura de cada columna
                const x = 5 + i * 2;          // separar columnas
                const y = j + 0.25;    // mitad de tamaño (size/2) + offset
                const z = -3;
                this.createBox(x, y, z); // tamaño reducido
            }
        }

        // Apilado de botellas
        const bottleHeight = 2;  // la altura visual física original
        const scale = 1;       // mitad de tamaño
        const totalHeight = bottleHeight * scale;

        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 3; j++) {
                const x = -5 - i * 2;
                const y = totalHeight / 2 + j * totalHeight; // colocar desde la mitad
                const z = -5;
                this.createBottle(x, y, z, scale);
            }
        }


        // Esferas
        for (let i = 0; i < 3; i++) {
            const x = 5 + i * 2;
            const y = 1;
            const z = -15;
            this.createSphere(x, y, z);  // esfera de radio reducido
        }

        // Conos
        for (let i = 0; i < 3; i++) {
            const x = -10 + i * 2;
            const y = 1.5;
            const z = -15;
            this.createCone(x, y, z, 1, 3); // radio y altura reducidos
        }
    }

    // Crear esfera
    createSphere(x, y, z, radius = 1) {
        // Visual
        const geometry = new THREE.SphereGeometry(radius, 16, 16);
        const material = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        this.scene.add(mesh);

        // Física
        const shape = new CANNON.Sphere(radius);
        const body = new CANNON.Body({ mass: 1, material: this.defaultMaterial });
        body.addShape(shape);
        body.position.set(x, y, z);
        this.world.addBody(body);

        this.boxes.push({ mesh, body }); // se puede usar boxes para simplificar
    }

    // Crear cono
    createCone(x, y, z, radius = 0.5, height = 1) {
        const geometry = new THREE.ConeGeometry(radius, height, 12);
        const material = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        this.scene.add(mesh);

        // Física con radio mínimo para SAPBroadphase
        const minRadius = 0.05;
        const shape = new CANNON.Cylinder(minRadius, radius, height, 12);
        const body = new CANNON.Body({ mass: 1, material: this.defaultMaterial });
        body.addShape(shape);
        body.position.set(x, y + height / 2, z); // ajustar altura inicial
        body.allowSleep = true;                  // opcional para estabilidad
        body.sleepSpeedLimit = 0.01;
        body.sleepTimeLimit = 1;

        this.world.addBody(body);
        this.boxes.push({ mesh, body });
    }


    // Ajustar cajas y botellas para aceptar tamaño reducido
    createBox(x, y, z, size = 1) {
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        this.scene.add(mesh);

        const shape = new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2));
        const body = new CANNON.Body({ mass: 1, material: this.defaultMaterial });
        body.addShape(shape);
        body.position.set(x, y, z);
        this.world.addBody(body);

        this.boxes.push({ mesh, body });
    }

    // Ajustar createBottle para tamaño reducido
    createBottle(x, y, z, scale = 1) {
        const geometry = new THREE.CylinderGeometry(0.3 * scale, 0.5 * scale, 2 * scale, 8);
        const material = new THREE.MeshLambertMaterial({
            color: 0x4169E1,
            transparent: true,
            opacity: 0.7
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        this.scene.add(mesh);

        const shape = new CANNON.Box(new CANNON.Vec3(0.5 * scale, 1 * scale, 0.5 * scale));
        const body = new CANNON.Body({ mass: 2, material: this.defaultMaterial });
        body.addShape(shape);
        body.position.set(x, y, z);
        this.world.addBody(body);

        this.bottles.push({ mesh, body, tipped: false });
    }

    resetGame() {
        // Reset auto
        if (this.car) {
            this.car.body.position.set(0, 1, 0)
            this.car.body.velocity.setZero()
            this.car.body.angularVelocity.setZero()
            this.car.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI)
        }

        // Reset cajas
        this.boxes.forEach(box => {
            box.body.position.copy(box.body.initPosition || new CANNON.Vec3(box.mesh.position.x, box.mesh.position.y, box.mesh.position.z))
            box.body.velocity.setZero()
            box.body.angularVelocity.setZero()
            box.body.quaternion.set(0, 0, 0, 1)
        })

        // Reset botellas
        this.bottles.forEach(bottle => {
            bottle.body.position.copy(bottle.body.initPosition || new CANNON.Vec3(bottle.mesh.position.x, bottle.mesh.position.y, bottle.mesh.position.z))
            bottle.body.velocity.setZero()
            bottle.body.angularVelocity.setZero()
            bottle.body.quaternion.set(0, 0, 0, 1)
        })
    }


    setupControls() {
        // Configurar cámara para seguir al auto
        this.cameraOffset = new THREE.Vector3(0, 5, 10)
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

    setupEventListeners() {
        // Keyboard events
        window.addEventListener('keydown', this.handleKeyDown)
        window.addEventListener('keyup', this.handleKeyUp)
        window.addEventListener('resize', this.handleResize)
    }

    updateCar(deltaTime) {
        const maxSteerVal = 0.5;
        const maxForce = 5000;
        const brakeForce = 5;

        // Girar ruedas delanteras
        let steer = 0;
        if (this.keys.a) steer = maxSteerVal;
        if (this.keys.d) steer = -maxSteerVal;

        this.car.vehicle.setSteeringValue(steer, 0); // Front right
        this.car.vehicle.setSteeringValue(steer, 1); // Front left

        // Aceleración / retroceso
        let engineForce = 0;
        if (this.keys.w) engineForce = -maxForce;
        if (this.keys.s) engineForce = maxForce;

        this.car.vehicle.applyEngineForce(engineForce, 2); // Rear right
        this.car.vehicle.applyEngineForce(engineForce, 3); // Rear left

        // Frenado gradual cuando no hay teclas presionadas
        if (!this.keys.w && !this.keys.s) {
            this.car.vehicle.setBrake(brakeForce, 2);
            this.car.vehicle.setBrake(brakeForce, 3);
        } else {
            this.car.vehicle.setBrake(0, 2);
            this.car.vehicle.setBrake(0, 3);
        }
    }



    updateCamera() {
        if (!this.car || !this.car.mesh) return

        const carPosition = this.car.mesh.position

        // --- 1. Calcular velocidad del coche ---
        const speed = this.car.body.velocity.length()

        // --- 2. Offset dinámico ---
        const dynamicOffset = this.cameraOffset.clone()
        dynamicOffset.z += Math.min(speed * 0.1, 15) // más atrás con más velocidad

        // --- 3. Posición suavizada ---
        const targetPosition = carPosition.clone().add(dynamicOffset)
        this.camera.position.lerp(targetPosition, 0.08)

        // --- 4. Mirar al coche directamente ---
        this.camera.lookAt(carPosition)
    }


    animate() {
        this.animationId = requestAnimationFrame(() => this.animate())

        const deltaTime = this.clock.getDelta()

        // Limitar deltaTime para estabilidad
        const maxDeltaTime = 1.0 / 30.0
        const clampedDeltaTime = Math.min(deltaTime, maxDeltaTime)

        // Actualizar física con fixed timestep
        this.world.step(this.world.fixedTimeStep, clampedDeltaTime, this.world.maxSubSteps)

        // Actualizar auto
        this.updateCar(clampedDeltaTime)

        if (this.car) {
            // Sincronizar chasis visual
            this.car.mesh.position.copy(this.car.body.position)
            this.car.mesh.quaternion.copy(this.car.body.quaternion)

            this.car.vehicle.wheelInfos.forEach((wheel, index) => {
                this.car.vehicle.updateWheelTransform(index)
                const t = wheel.worldTransform
                const wheelMesh = this.car.wheels[index]

                // Posición
                wheelMesh.position.copy(t.position)

                // Rotación
                const q = new THREE.Quaternion(t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w)
                // Rotar el cilindro para alinear la geometría con el eje físico
                const correction = new THREE.Quaternion()
                correction.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2) // rotación Z
                q.multiply(correction)

                wheelMesh.quaternion.copy(q)
            })


        }

        // Actualizar cajas y botellas
        this.boxes.forEach(box => {
            box.mesh.position.copy(box.body.position)
            box.mesh.quaternion.copy(box.body.quaternion)
        })

        this.bottles.forEach(bottle => {
            bottle.mesh.position.copy(bottle.body.position)
            bottle.mesh.quaternion.copy(bottle.body.quaternion)
        })

        // Actualizar cámara
        this.updateCamera()

        // Render
        this.renderer.render(this.scene, this.camera)
    }


    start() {
        console.log('Starting game engine...')
        console.log('Scene children:', this.scene.children.length)
        console.log('Camera position:', this.camera.position)
        this.animate()
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId)
        }

        if (this.renderer) {
            this.renderer.dispose()
        }

        // Cleanup event listeners
        window.removeEventListener('keydown', this.handleKeyDown)
        window.removeEventListener('keyup', this.handleKeyUp)
        window.removeEventListener('resize', this.handleResize)
    }
}