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

        this.instancedBoxes = null
        this.boxInstances = []
        this.sharedMaterials = null

        // Bind methods to preserve 'this' context
        this.handleKeyDown = this.handleKeyDown.bind(this)
        this.handleKeyUp = this.handleKeyUp.bind(this)
        this.handleResize = this.handleResize.bind(this)
    }

    initSharedMaterials() {
        this.sharedMaterials = {
            box: new THREE.MeshLambertMaterial({ color: 0xff6b6b }),
            bottle: new THREE.MeshLambertMaterial({
                color: 0x4169E1,
                transparent: true,
                opacity: 0.7
            }),
            sphere: new THREE.MeshLambertMaterial({ color: 0x4fc3f7 }),
            cone: new THREE.MeshLambertMaterial({ color: 0xffa726 })
        }
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
            antialias: false, // Desactivar antialiasing para mejor performance
            powerPreference: "high-performance"
        })

        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // Limitar pixel ratio

        // OPTIMIZACIÓN 2: Configuración conservadora de sombras
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.BasicShadowMap // Más rápido que PCFSoftShadowMap

        // OPTIMIZACIÓN 3: Frustum culling más agresivo
        this.camera.near = 0.5
        this.camera.far = 100 // Reducir de 1000 a 100

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

        this.world.allowSleep = true
        this.world.sleepSpeedLimit = 0.1
        this.world.sleepTimeLimit = 1

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
        const islandRadius = 20
        const positions = [
            { x: 0, z: 0, color: 0x55aa55, name: 'central' },     // isla central
            { x: 0, z: -65, color: 0x559955, name: 'norte' },     // isla norte
            { x: 65, z: -65, color: 0x558855, name: 'este' },     // mover isla este hacia norte
            { x: -65, z: -65, color: 0x557755, name: 'oeste' },   // mover isla oeste hacia norte
            { x: 0, z: 65, color: 0x556655, name: 'sur' }         // isla sur
        ]

        this.islands = []

        positions.forEach((pos) => {
            // Visual
            const geometry = new THREE.CircleGeometry(islandRadius, 64)
            const material = new THREE.MeshLambertMaterial({ color: pos.color })
            const mesh = new THREE.Mesh(geometry, material)
            mesh.rotation.x = -Math.PI / 2
            mesh.position.set(pos.x, 0, pos.z)
            mesh.receiveShadow = true
            this.scene.add(mesh)

            // Física
            const shape = new CANNON.Cylinder(islandRadius, islandRadius, 1, 32)
            const body = new CANNON.Body({ mass: 0, material: this.defaultMaterial })
            body.addShape(shape)
            body.position.set(pos.x, -0.5, pos.z)
            this.world.addBody(body)

            this.islands.push({ mesh, body, name: pos.name })
        })

        // Crear puentes conectando la isla norte con este y oeste
        this.createBridge({ x: 23, z: -60 }, { x: 51, z: -60 })   // puente norte-este
        this.createBridge({ x: -23, z: -60 }, { x: -51, z: -60 })  // puente norte-oeste

        // Mantener puentes de central a norte y sur
        this.createBridge({ x: 0, z: -24 }, { x: 0, z: -49 }) // norte-central
        this.createBridge({ x: 0, z: 24 }, { x: 0, z: 49 })   // sur-central

        console.log("✅ Islas este y oeste ahora conectadas a norte")
    }

    createBridge(start, end) {
        const plankLength = 10   // largo de cada tablón
        const plankWidth = 1     // ancho del tablón
        const separation = 1     // separación lateral entre los dos puentes
        const height = 0.2       // altura del puente

        const dx = end.x - start.x
        const dz = end.z - start.z
        const distance = Math.sqrt(dx * dx + dz * dz)
        const steps = Math.ceil(distance / plankLength)

        // Ángulo de dirección del puente
        const angle = Math.atan2(dz, dx)

        // Vector perpendicular para separar las dos pasarelas
        const offsetX = Math.sin(angle) * separation
        const offsetZ = -Math.cos(angle) * separation

        for (let i = 0; i < steps; i++) {
            const t = i / steps
            const x = start.x + dx * t
            const z = start.z + dz * t
            const y = height

                // 🔹 Crear las dos pasarelas (izquierda y derecha)
                ;[-1, 1].forEach(side => {
                    const px = x + offsetX * side
                    const pz = z + offsetZ * side

                    // Visual
                    const geometry = new THREE.BoxGeometry(plankLength, 0.2, plankWidth)
                    const material = new THREE.MeshLambertMaterial({ color: 0x8B4513 })
                    const mesh = new THREE.Mesh(geometry, material)
                    mesh.castShadow = true
                    mesh.receiveShadow = true
                    mesh.position.set(px, y, pz)
                    mesh.rotation.y = -angle
                    this.scene.add(mesh)

                    // Física
                    const shape = new CANNON.Box(new CANNON.Vec3(plankLength / 2, 0.1, plankWidth / 2))
                    const body = new CANNON.Body({ mass: 0, material: this.defaultMaterial })
                    body.addShape(shape)
                    body.position.set(px, y, pz)
                    body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -angle)
                    this.world.addBody(body)
                })
        }
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
        // Inicializar materiales compartidos
        this.initSharedMaterials()

        // --- OPTIMIZACIÓN 6: Instanced rendering para cajas ---
        this.createInstancedBoxTowers()

        // --- Resto de objetos (sin cambios) ---
        const norte = this.islands.find(i => i.name === 'norte')
        const bottleCols = 6
        const bottleRows = 3
        for (let i = 0; i < bottleCols; i++) {
            for (let j = 0; j < bottleRows; j++) {
                const offsetX = -3 + i * 1.2
                const offsetZ = -2
                const offsetY = 1 + j * 2
                this.createBottle(norte.mesh.position.x + offsetX, offsetY, norte.mesh.position.z + offsetZ)
            }
        }

        const este = this.islands.find(i => i.name === 'este')
        const sphereCount = 4
        for (let i = 0; i < sphereCount; i++) {
            const offsetX = 0
            const offsetZ = -8 + i * 4
            const offsetY = 2
            this.createSphere(este.mesh.position.x + offsetX, offsetY, este.mesh.position.z + offsetZ, 2)
        }

        const oeste = this.islands.find(i => i.name === 'oeste')
        const coneCount = 6
        for (let i = 0; i < coneCount; i++) {
            const offsetX = 0
            const offsetZ = -5 + i * 2
            const offsetY = 1.5
            this.createCone(oeste.mesh.position.x + offsetX, offsetY, oeste.mesh.position.z + offsetZ, 1, 3)
        }

        const sur = this.islands.find(i => i.name === 'sur')
        for (let i = 0; i < 3; i++) {
            const boxOffsetX = -2 + i * 2
            const boxOffsetY = 1
            this.createBox(sur.mesh.position.x + boxOffsetX, boxOffsetY, sur.mesh.position.z)

            const bottleOffsetX = 2 + i * 2
            const bottleOffsetY = 1
            this.createBottle(sur.mesh.position.x + bottleOffsetX, bottleOffsetY, sur.mesh.position.z)
        }
    }

    createInstancedBoxTowers() {
        const central = this.islands.find(i => i.name === 'central')
        const towerHeight = 5
        const towersPerGroup = 3
        const boxSize = 1
        const towerSpacing = 1
        const groupOffset = 7

        const corners = [
            { x: -groupOffset, z: -groupOffset },
            { x: groupOffset, z: -groupOffset },
            { x: -groupOffset, z: groupOffset },
            { x: groupOffset, z: groupOffset }
        ]
        const totalBoxes = corners.length * towersPerGroup * towerHeight

        // Crear instanced mesh
        const boxGeometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize)
        this.instancedBoxes = new THREE.InstancedMesh(
            boxGeometry,
            this.sharedMaterials.box,
            totalBoxes
        )
        this.instancedBoxes.castShadow = true
        this.instancedBoxes.receiveShadow = true
        this.scene.add(this.instancedBoxes)

        // Crear instancias y cuerpos físicos
        const matrix = new THREE.Matrix4()
        const position = new THREE.Vector3()
        const quaternion = new THREE.Quaternion()
        const scale = new THREE.Vector3(1, 1, 1)

        let instanceIndex = 0

        corners.forEach(corner => {
            for (let t = 0; t < towersPerGroup; t++) {
                const offsetX = t * towerSpacing
                const offsetZ = 0

                for (let k = 0; k < towerHeight; k++) {
                    const x = central.mesh.position.x + corner.x + offsetX
                    const y = 0.5 + k * boxSize
                    const z = central.mesh.position.z + corner.z + offsetZ

                    // Configurar matriz de transformación
                    position.set(x, y, z)
                    matrix.compose(position, quaternion, scale)
                    this.instancedBoxes.setMatrixAt(instanceIndex, matrix)

                    // Crear cuerpo físico
                    const shape = new CANNON.Box(new CANNON.Vec3(boxSize / 2, boxSize / 2, boxSize / 2))
                    const body = new CANNON.Body({
                        mass: 1,
                        material: this.defaultMaterial,
                        allowSleep: true,
                        sleepSpeedLimit: 0.1,
                        sleepTimeLimit: 1
                    })
                    body.addShape(shape)
                    body.position.set(x, y, z)
                    this.world.addBody(body)

                    // IMPORTANTE: Guardar posición y rotación inicial
                    const initialPosition = new CANNON.Vec3(x, y, z)
                    const initialQuaternion = new CANNON.Quaternion(0, 0, 0, 1)

                    // Guardar referencia con datos iniciales
                    this.boxInstances.push({
                        body,
                        instanceIndex,
                        isActive: true,
                        initialPosition: initialPosition.clone(),
                        initialQuaternion: initialQuaternion.clone()
                    })

                    instanceIndex++
                }
            }
        })

        this.instancedBoxes.instanceMatrix.needsUpdate = true
        console.log(`✅ Created ${totalBoxes} instanced boxes with single draw call`)
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
        const geometry = new THREE.BoxGeometry(size, size, size)
        const material = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(x, y, z)
        mesh.castShadow = true
        this.scene.add(mesh)

        const shape = new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2))
        const body = new CANNON.Body({ mass: 1, material: this.defaultMaterial })
        body.addShape(shape)
        body.position.set(x, y, z)

        // NUEVO: Guardar posición inicial
        body.initPosition = new CANNON.Vec3(x, y, z)

        this.world.addBody(body)
        this.boxes.push({ mesh, body })
    }

    createBottle(x, y, z, scale = 1) {
        const geometry = new THREE.CylinderGeometry(0.3 * scale, 0.5 * scale, 2 * scale, 8)
        const material = new THREE.MeshLambertMaterial({
            color: 0x4169E1,
            transparent: true,
            opacity: 0.7
        })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(x, y, z)
        mesh.castShadow = true
        this.scene.add(mesh)

        const shape = new CANNON.Box(new CANNON.Vec3(0.5 * scale, 1 * scale, 0.5 * scale))
        const body = new CANNON.Body({ mass: 2, material: this.defaultMaterial })
        body.addShape(shape)
        body.position.set(x, y, z)

        // NUEVO: Guardar posición inicial
        body.initPosition = new CANNON.Vec3(x, y, z)

        this.world.addBody(body)
        this.bottles.push({ mesh, body, tipped: false })
    }

    resetGame() {
        console.log('🔄 Resetting game...')

        // Reset auto
        if (this.car) {
            this.car.body.position.set(0, 1, 0)
            this.car.body.velocity.setZero()
            this.car.body.angularVelocity.setZero()
            this.car.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI)
        }

        // NUEVO: Reset cajas instanciadas (torres)
        if (this.boxInstances && this.boxInstances.length > 0) {
            console.log(`🔄 Resetting ${this.boxInstances.length} instanced boxes...`)

            const matrix = new THREE.Matrix4()
            const position = new THREE.Vector3()
            const quaternion = new THREE.Quaternion()
            const scale = new THREE.Vector3(1, 1, 1)

            this.boxInstances.forEach(boxInstance => {
                const { body, instanceIndex, initialPosition, initialQuaternion } = boxInstance

                // Reset física
                body.position.copy(initialPosition)
                body.quaternion.copy(initialQuaternion)
                body.velocity.setZero()
                body.angularVelocity.setZero()

                // Despertar el cuerpo si estaba dormido
                body.wakeUp()

                // Reset visual (instanced mesh)
                position.copy(initialPosition)
                quaternion.copy(initialQuaternion)
                matrix.compose(position, quaternion, scale)
                this.instancedBoxes.setMatrixAt(instanceIndex, matrix)
            })

            // Marcar que la matriz necesita actualización
            this.instancedBoxes.instanceMatrix.needsUpdate = true
        }

        // Reset cajas individuales (las que no son torres)
        if (this.boxes && this.boxes.length > 0) {
            console.log(`🔄 Resetting ${this.boxes.length} individual boxes...`)

            this.boxes.forEach(box => {
                // Si no tiene posición inicial guardada, usar la posición actual del mesh
                const initialPos = box.body.initPosition || box.mesh.position

                box.body.position.set(initialPos.x, initialPos.y, initialPos.z)
                box.body.velocity.setZero()
                box.body.angularVelocity.setZero()
                box.body.quaternion.set(0, 0, 0, 1)
                box.body.wakeUp()
            })
        }

        // Reset botellas
        if (this.bottles && this.bottles.length > 0) {
            console.log(`🔄 Resetting ${this.bottles.length} bottles...`)

            this.bottles.forEach(bottle => {
                // Si no tiene posición inicial guardada, usar la posición actual del mesh
                const initialPos = bottle.body.initPosition || bottle.mesh.position

                bottle.body.position.set(initialPos.x, initialPos.y, initialPos.z)
                bottle.body.velocity.setZero()
                bottle.body.angularVelocity.setZero()
                bottle.body.quaternion.set(0, 0, 0, 1)
                bottle.tipped = false
                bottle.body.wakeUp()
            })
        }

        console.log('✅ Game reset complete!')
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

            // Actualizar ruedas
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

        // NUEVO: Actualizar cajas instanciadas (torres de la isla central)
        this.updateInstancedBoxes()

        // Actualizar cajas individuales (las de la isla sur y otras)
        this.boxes.forEach(box => {
            box.mesh.position.copy(box.body.position)
            box.mesh.quaternion.copy(box.body.quaternion)
        })

        // Actualizar botellas
        this.bottles.forEach(bottle => {
            bottle.mesh.position.copy(bottle.body.position)
            bottle.mesh.quaternion.copy(bottle.body.quaternion)
        })

        // Actualizar cámara
        this.updateCamera()

        // Render
        this.renderer.render(this.scene, this.camera)
    }

    updateInstancedBoxes() {
        if (!this.instancedBoxes || !this.boxInstances.length) return

        const matrix = new THREE.Matrix4()
        const position = new THREE.Vector3()
        const quaternion = new THREE.Quaternion()
        const scale = new THREE.Vector3(1, 1, 1)

        let needsUpdate = false

        this.boxInstances.forEach((boxInstance) => {
            const body = boxInstance.body

            // Solo actualizar si el cuerpo está activo (se movió)
            if (!body.sleepState || body.sleepState === 0) {
                position.copy(body.position)
                quaternion.copy(body.quaternion)

                matrix.compose(position, quaternion, scale)
                this.instancedBoxes.setMatrixAt(boxInstance.instanceIndex, matrix)
                needsUpdate = true
            }
        })

        if (needsUpdate) {
            this.instancedBoxes.instanceMatrix.needsUpdate = true
        }
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

        // Limpiar instanced mesh
        if (this.instancedBoxes) {
            this.instancedBoxes.geometry.dispose()
            if (this.instancedBoxes.material.dispose) {
                this.instancedBoxes.material.dispose()
            }
        }

        // Limpiar materiales compartidos
        if (this.sharedMaterials) {
            Object.values(this.sharedMaterials).forEach(material => {
                if (material.dispose) material.dispose()
            })
        }

        if (this.renderer) {
            this.renderer.dispose()
        }

        window.removeEventListener('keydown', this.handleKeyDown)
        window.removeEventListener('keyup', this.handleKeyUp)
        window.removeEventListener('resize', this.handleResize)
    }
}