import * as THREE from 'three'
import * as CANNON from 'cannon-es'

// Configuration constants
const CONFIG = {
    PHYSICS: {
        GRAVITY: -9.82,
        FIXED_TIMESTEP: 1 / 60,
        MAX_SUBSTEPS: 3,
        SOLVER_ITERATIONS: 10,
        SOLVER_TOLERANCE: 0.01,
        DEFAULT_FRICTION: 0.4,
        DEFAULT_RESTITUTION: 0.3,
        SLEEP_SPEED_LIMIT: 0.1,
        SLEEP_TIME_LIMIT: 1
    },
    RENDERING: {
        PIXEL_RATIO_LIMIT: 1,
        CAMERA_NEAR: 0.5,
        CAMERA_FAR: 500,  // Aumentado de 100 a 500
        SHADOW_MAP_SIZE: 2048,
        FOG_NEAR: 150,    // Aumentado de 50 a 150
        FOG_FAR: 400      // Aumentado de 200 a 400
    },
    WORLD: {
        ISLAND_RADIUS: 20,
        BRIDGE_PLANK_LENGTH: 10,
        BRIDGE_WIDTH: 1,
        BRIDGE_HEIGHT: 0.2,
        BRIDGE_SEPARATION: 1
    },
    CAR: {
        WIDTH: 2,
        HEIGHT: 0.5,
        LENGTH: 3,
        MASS: 1000,
        WHEEL_RADIUS: 0.4,
        MAX_STEER: 0.5,
        MAX_FORCE: 5000,
        BRAKE_FORCE: 5
    },
    CAMERA: {
        FOLLOW_SPEED: 0.08,
        DYNAMIC_OFFSET_MULT: 0.1,
        MAX_DYNAMIC_OFFSET: 25,    // Aumentado de 15 a 25
        BASE_HEIGHT: 5,            // Nueva: altura base de cámara
        BASE_DISTANCE: 12          // Nueva: distancia base de cámara
    },
    INSTANCES: {
        TOWER_HEIGHT: 5,
        TOWERS_PER_GROUP: 3,
        BOX_SIZE: 1,
        TOWER_SPACING: 1,
        GROUP_OFFSET: 7
    }
}

class ObjectPool {
    constructor() {
        this.tempVec3 = new THREE.Vector3()
        this.tempQuaternion = new THREE.Quaternion()
        this.tempMatrix4 = new THREE.Matrix4()
        this.tempEuler = new THREE.Euler()
    }

    getTempVec3() {
        return this.tempVec3
    }

    getTempQuaternion() {
        return this.tempQuaternion
    }

    getTempMatrix4() {
        return this.tempMatrix4
    }

    getTempEuler() {
        return this.tempEuler
    }
}

class MaterialManager {
    constructor() {
        this.materials = new Map()
        this.createSharedMaterials()
    }

    createSharedMaterials() {
        this.materials.set('box', new THREE.MeshLambertMaterial({ color: 0xff6b6b }))
        this.materials.set('bottle', new THREE.MeshLambertMaterial({
            color: 0x4169E1,
            transparent: true,
            opacity: 0.7
        }))
        this.materials.set('sphere', new THREE.MeshLambertMaterial({ color: 0x4fc3f7 }))
        this.materials.set('cone', new THREE.MeshLambertMaterial({ color: 0xffa726 }))
        this.materials.set('car', new THREE.MeshLambertMaterial({ color: 0x030459 }))
        this.materials.set('wheel', new THREE.MeshLambertMaterial({ color: 0x333333 }))
        this.materials.set('bridge', new THREE.MeshLambertMaterial({ color: 0x8B4513 }))
    }

    getMaterial(type) {
        return this.materials.get(type)
    }

    dispose() {
        this.materials.forEach(material => {
            if (material.dispose) material.dispose()
        })
        this.materials.clear()
    }
}

class GeometryManager {
    constructor() {
        this.geometries = new Map()
        this.createSharedGeometries()
    }

    createSharedGeometries() {
        // Box geometries
        this.geometries.set('box', new THREE.BoxGeometry(CONFIG.INSTANCES.BOX_SIZE, CONFIG.INSTANCES.BOX_SIZE, CONFIG.INSTANCES.BOX_SIZE))
        this.geometries.set('bottle', new THREE.CylinderGeometry(0.3, 0.5, 2, 8))
        this.geometries.set('sphere', new THREE.SphereGeometry(1, 16, 16))
        this.geometries.set('cone', new THREE.ConeGeometry(0.5, 1, 12))

        // Car geometries
        this.geometries.set('carBody', new THREE.BoxGeometry(CONFIG.CAR.WIDTH, CONFIG.CAR.HEIGHT, CONFIG.CAR.LENGTH))
        this.geometries.set('carRoof', new THREE.BoxGeometry(CONFIG.CAR.WIDTH * 0.8, CONFIG.CAR.HEIGHT * 0.6, CONFIG.CAR.LENGTH * 0.6))
        this.geometries.set('wheel', new THREE.CylinderGeometry(CONFIG.CAR.WHEEL_RADIUS, CONFIG.CAR.WHEEL_RADIUS, 0.4, 16))

        // World geometries
        this.geometries.set('island', new THREE.CircleGeometry(CONFIG.WORLD.ISLAND_RADIUS, 64))
        this.geometries.set('bridge', new THREE.BoxGeometry(CONFIG.WORLD.BRIDGE_PLANK_LENGTH, CONFIG.WORLD.BRIDGE_HEIGHT, CONFIG.WORLD.BRIDGE_WIDTH))
    }

    getGeometry(type) {
        return this.geometries.get(type)
    }

    dispose() {
        this.geometries.forEach(geometry => {
            if (geometry.dispose) geometry.dispose()
        })
        this.geometries.clear()
    }
}

class InstancedObjectManager {
    constructor(scene, world, materials, geometries, objectPool) {
        this.scene = scene
        this.world = world
        this.materials = materials
        this.geometries = geometries
        this.objectPool = objectPool

        this.instancedMeshes = new Map()
        this.instances = new Map()
        this.needsUpdate = new Set()
    }

    createInstancedBoxes(totalCount, positions) {
        const geometry = this.geometries.getGeometry('box')
        const material = this.materials.getMaterial('box')

        const instancedMesh = new THREE.InstancedMesh(geometry, material, totalCount)
        instancedMesh.castShadow = true
        instancedMesh.receiveShadow = true
        this.scene.add(instancedMesh)

        this.instancedMeshes.set('boxes', instancedMesh)
        this.instances.set('boxes', [])

        const matrix = this.objectPool.getTempMatrix4()
        const position = this.objectPool.getTempVec3()
        const quaternion = this.objectPool.getTempQuaternion()
        const scale = new THREE.Vector3(1, 1, 1)

        positions.forEach((pos, index) => {
            // Set visual
            position.set(pos.x, pos.y, pos.z)
            quaternion.set(0, 0, 0, 1)
            matrix.compose(position, quaternion, scale)
            instancedMesh.setMatrixAt(index, matrix)

            // Create physics body
            const shape = new CANNON.Box(new CANNON.Vec3(
                CONFIG.INSTANCES.BOX_SIZE / 2,
                CONFIG.INSTANCES.BOX_SIZE / 2,
                CONFIG.INSTANCES.BOX_SIZE / 2
            ))
            const body = new CANNON.Body({
                mass: 1,
                allowSleep: true,
                sleepSpeedLimit: CONFIG.PHYSICS.SLEEP_SPEED_LIMIT,
                sleepTimeLimit: CONFIG.PHYSICS.SLEEP_TIME_LIMIT
            })
            body.addShape(shape)
            body.position.set(pos.x, pos.y, pos.z)
            this.world.addBody(body)

            // Store instance data
            this.instances.get('boxes').push({
                body,
                instanceIndex: index,
                initialPosition: new CANNON.Vec3(pos.x, pos.y, pos.z),
                initialQuaternion: new CANNON.Quaternion(0, 0, 0, 1)
            })
        })

        instancedMesh.instanceMatrix.needsUpdate = true
    }

    update() {
        const matrix = this.objectPool.getTempMatrix4()
        const position = this.objectPool.getTempVec3()
        const quaternion = this.objectPool.getTempQuaternion()
        const scale = new THREE.Vector3(1, 1, 1)

        this.instances.forEach((instanceArray, type) => {
            const instancedMesh = this.instancedMeshes.get(type)
            if (!instancedMesh) return

            let needsUpdate = false

            instanceArray.forEach(instance => {
                const { body, instanceIndex } = instance

                // Only update if body is active (moved)
                if (!body.sleepState || body.sleepState === 0) {
                    position.copy(body.position)
                    quaternion.copy(body.quaternion)

                    matrix.compose(position, quaternion, scale)
                    instancedMesh.setMatrixAt(instanceIndex, matrix)
                    needsUpdate = true
                }
            })

            if (needsUpdate) {
                instancedMesh.instanceMatrix.needsUpdate = true
            }
        })
    }

    reset() {
        const matrix = this.objectPool.getTempMatrix4()
        const position = this.objectPool.getTempVec3()
        const quaternion = this.objectPool.getTempQuaternion()
        const scale = new THREE.Vector3(1, 1, 1)

        this.instances.forEach((instanceArray, type) => {
            const instancedMesh = this.instancedMeshes.get(type)
            if (!instancedMesh) return

            instanceArray.forEach(instance => {
                const { body, instanceIndex, initialPosition, initialQuaternion } = instance

                // Reset physics
                body.position.copy(initialPosition)
                body.quaternion.copy(initialQuaternion)
                body.velocity.setZero()
                body.angularVelocity.setZero()
                body.wakeUp()

                // Reset visual
                position.copy(initialPosition)
                quaternion.copy(initialQuaternion)
                matrix.compose(position, quaternion, scale)
                instancedMesh.setMatrixAt(instanceIndex, matrix)
            })

            instancedMesh.instanceMatrix.needsUpdate = true
        })
    }

    dispose() {
        this.instancedMeshes.forEach(mesh => {
            this.scene.remove(mesh)
            if (mesh.dispose) mesh.dispose()
        })
        this.instancedMeshes.clear()
        this.instances.clear()
    }
}

class GameObjectManager {
    constructor(scene, world, materials, geometries) {
        this.scene = scene
        this.world = world
        this.materials = materials
        this.geometries = geometries

        this.gameObjects = new Map()
        this.gameObjects.set('bottles', [])
        this.gameObjects.set('spheres', [])
        this.gameObjects.set('cones', [])
        this.gameObjects.set('boxes', [])
    }

    createBottle(x, y, z, scale = 1) {
        const geometry = this.geometries.getGeometry('bottle')
        const material = this.materials.getMaterial('bottle')

        const mesh = new THREE.Mesh(geometry, material)
        mesh.scale.setScalar(scale)
        mesh.position.set(x, y, z)
        mesh.castShadow = true
        this.scene.add(mesh)

        const shape = new CANNON.Box(new CANNON.Vec3(0.5 * scale, 1 * scale, 0.5 * scale))
        const body = new CANNON.Body({
            mass: 2,
            allowSleep: true,
            sleepSpeedLimit: CONFIG.PHYSICS.SLEEP_SPEED_LIMIT,
            sleepTimeLimit: CONFIG.PHYSICS.SLEEP_TIME_LIMIT
        })
        body.addShape(shape)
        body.position.set(x, y, z)
        this.world.addBody(body)

        const gameObject = {
            mesh,
            body,
            initialPosition: new CANNON.Vec3(x, y, z),
            initialQuaternion: new CANNON.Quaternion(0, 0, 0, 1),
            tipped: false
        }

        this.gameObjects.get('bottles').push(gameObject)
        return gameObject
    }

    createSphere(x, y, z, radius = 1) {
        const geometry = this.geometries.getGeometry('sphere')
        const material = this.materials.getMaterial('sphere')

        const mesh = new THREE.Mesh(geometry, material)
        mesh.scale.setScalar(radius)
        mesh.position.set(x, y, z)
        mesh.castShadow = true
        this.scene.add(mesh)

        const shape = new CANNON.Sphere(radius)
        const body = new CANNON.Body({
            mass: 1,
            allowSleep: true,
            sleepSpeedLimit: CONFIG.PHYSICS.SLEEP_SPEED_LIMIT,
            sleepTimeLimit: CONFIG.PHYSICS.SLEEP_TIME_LIMIT
        })
        body.addShape(shape)
        body.position.set(x, y, z)
        this.world.addBody(body)

        const gameObject = {
            mesh,
            body,
            initialPosition: new CANNON.Vec3(x, y, z),
            initialQuaternion: new CANNON.Quaternion(0, 0, 0, 1)
        }

        this.gameObjects.get('spheres').push(gameObject)
        return gameObject
    }

    createCone(x, y, z, radius = 0.5, height = 1) {
        const geometry = this.geometries.getGeometry('cone')
        const material = this.materials.getMaterial('cone')

        const mesh = new THREE.Mesh(geometry, material)
        mesh.scale.set(radius, height, radius)
        mesh.position.set(x, y, z)
        mesh.castShadow = true
        this.scene.add(mesh)

        const minRadius = 0.05
        const shape = new CANNON.Cylinder(minRadius, radius, height, 12)
        const body = new CANNON.Body({
            mass: 1,
            allowSleep: true,
            sleepSpeedLimit: CONFIG.PHYSICS.SLEEP_SPEED_LIMIT,
            sleepTimeLimit: CONFIG.PHYSICS.SLEEP_TIME_LIMIT
        })
        body.addShape(shape)
        body.position.set(x, y + height / 2, z)
        this.world.addBody(body)

        const gameObject = {
            mesh,
            body,
            initialPosition: new CANNON.Vec3(x, y + height / 2, z),
            initialQuaternion: new CANNON.Quaternion(0, 0, 0, 1)
        }

        this.gameObjects.get('cones').push(gameObject)
        return gameObject
    }

    createBox(x, y, z, size = 1) {
        const geometry = this.geometries.getGeometry('box')
        const material = this.materials.getMaterial('box')

        const mesh = new THREE.Mesh(geometry, material)
        mesh.scale.setScalar(size)
        mesh.position.set(x, y, z)
        mesh.castShadow = true
        this.scene.add(mesh)

        const shape = new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2))
        const body = new CANNON.Body({
            mass: 1,
            allowSleep: true,
            sleepSpeedLimit: CONFIG.PHYSICS.SLEEP_SPEED_LIMIT,
            sleepTimeLimit: CONFIG.PHYSICS.SLEEP_TIME_LIMIT
        })
        body.addShape(shape)
        body.position.set(x, y, z)
        this.world.addBody(body)

        const gameObject = {
            mesh,
            body,
            initialPosition: new CANNON.Vec3(x, y, z),
            initialQuaternion: new CANNON.Quaternion(0, 0, 0, 1)
        }

        this.gameObjects.get('boxes').push(gameObject)
        return gameObject
    }

    update() {
        this.gameObjects.forEach(objectArray => {
            objectArray.forEach(gameObject => {
                gameObject.mesh.position.copy(gameObject.body.position)
                gameObject.mesh.quaternion.copy(gameObject.body.quaternion)
            })
        })
    }

    reset() {
        this.gameObjects.forEach(objectArray => {
            objectArray.forEach(gameObject => {
                gameObject.body.position.copy(gameObject.initialPosition)
                gameObject.body.quaternion.copy(gameObject.initialQuaternion)
                gameObject.body.velocity.setZero()
                gameObject.body.angularVelocity.setZero()
                gameObject.body.wakeUp()

                if (gameObject.tipped !== undefined) {
                    gameObject.tipped = false
                }
            })
        })
    }

    dispose() {
        this.gameObjects.forEach(objectArray => {
            objectArray.forEach(gameObject => {
                this.scene.remove(gameObject.mesh)
                this.world.removeBody(gameObject.body)
            })
        })
        this.gameObjects.clear()
    }
}

export default class GameEngine {
    constructor(canvas) {

        this.lastFpsUpdate = performance.now()
        this.frameCount = 0

        this.canvas = canvas
        this.scene = null
        this.camera = null
        this.renderer = null
        this.world = null
        this.clock = new THREE.Clock()
        this.animationId = null

        // Managers
        this.objectPool = new ObjectPool()
        this.materialManager = new MaterialManager()
        this.geometryManager = new GeometryManager()
        this.instancedObjectManager = null
        this.gameObjectManager = null

        // Controls
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false
        }

        // Game objects
        this.car = null
        this.islands = []
        this.cameraOffset = new THREE.Vector3(0, CONFIG.CAMERA.BASE_HEIGHT, CONFIG.CAMERA.BASE_DISTANCE)

        // Bind methods
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
            this.initPhysics()
            this.initLighting()
            this.initManagers()
            this.initWorld()
            this.initCar()
            this.initGameObjects()
            this.setupEventListeners()
            console.log('GameEngine initialized successfully')
        } catch (error) {
            console.error('Error initializing GameEngine:', error)
        }
    }

    initThreeJS() {
        // Scene
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color(0x87CEEB)
        this.scene.fog = new THREE.Fog(0x87CEEB, CONFIG.RENDERING.FOG_NEAR, CONFIG.RENDERING.FOG_FAR)

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, CONFIG.RENDERING.CAMERA_NEAR, CONFIG.RENDERING.CAMERA_FAR)
        this.camera.position.set(0, CONFIG.CAMERA.BASE_HEIGHT, CONFIG.CAMERA.BASE_DISTANCE)
        this.camera.lookAt(0, 0, 0)

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: false,
            powerPreference: "high-performance"
        })
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.RENDERING.PIXEL_RATIO_LIMIT))
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.BasicShadowMap
    }

    initPhysics() {
        this.world = new CANNON.World()
        this.world.gravity.set(0, CONFIG.PHYSICS.GRAVITY, 0)
        this.world.broadphase = new CANNON.SAPBroadphase(this.world)
        this.world.broadphase.axisIndex = 2

        this.world.solver.iterations = CONFIG.PHYSICS.SOLVER_ITERATIONS
        this.world.solver.tolerance = CONFIG.PHYSICS.SOLVER_TOLERANCE
        this.world.fixedTimeStep = CONFIG.PHYSICS.FIXED_TIMESTEP
        this.world.maxSubSteps = CONFIG.PHYSICS.MAX_SUBSTEPS

        this.defaultMaterial = new CANNON.Material('default')
        this.world.defaultContactMaterial.friction = CONFIG.PHYSICS.DEFAULT_FRICTION
        this.world.defaultContactMaterial.restitution = CONFIG.PHYSICS.DEFAULT_RESTITUTION

        this.world.allowSleep = true
        this.world.sleepSpeedLimit = CONFIG.PHYSICS.SLEEP_SPEED_LIMIT
        this.world.sleepTimeLimit = CONFIG.PHYSICS.SLEEP_TIME_LIMIT
    }

    initLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
        this.scene.add(ambientLight)

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(10, 20, 10)
        directionalLight.castShadow = true
        directionalLight.shadow.mapSize.width = CONFIG.RENDERING.SHADOW_MAP_SIZE
        directionalLight.shadow.mapSize.height = CONFIG.RENDERING.SHADOW_MAP_SIZE
        directionalLight.shadow.camera.near = 0.5
        directionalLight.shadow.camera.far = 100  // Aumentado de 50 a 100
        directionalLight.shadow.camera.left = -50  // Aumentado de -20 a -50
        directionalLight.shadow.camera.right = 50   // Aumentado de 20 a 50
        directionalLight.shadow.camera.top = 50     // Aumentado de 20 a 50
        directionalLight.shadow.camera.bottom = -50 // Aumentado de -20 a -50
        this.scene.add(directionalLight)
    }

    initManagers() {
        this.instancedObjectManager = new InstancedObjectManager(
            this.scene,
            this.world,
            this.materialManager,
            this.geometryManager,
            this.objectPool
        )
        this.gameObjectManager = new GameObjectManager(
            this.scene,
            this.world,
            this.materialManager,
            this.geometryManager
        )
    }

    initWorld() {
        this.createIslands()
        this.createBridges()
    }

    createIslands() {
        const positions = [
            { x: 0, z: 0, color: 0x55aa55, name: 'central' },
            { x: 0, z: -65, color: 0x559955, name: 'norte' },
            { x: 65, z: -65, color: 0x558855, name: 'este' },
            { x: -65, z: -65, color: 0x557755, name: 'oeste' },
            { x: 0, z: 65, color: 0x556655, name: 'sur' }
        ]

        this.islands = []

        positions.forEach(pos => {
            // Visual
            const geometry = this.geometryManager.getGeometry('island')
            const material = new THREE.MeshLambertMaterial({ color: pos.color })
            const mesh = new THREE.Mesh(geometry, material)
            mesh.rotation.x = -Math.PI / 2
            mesh.position.set(pos.x, 0, pos.z)
            mesh.receiveShadow = true
            this.scene.add(mesh)

            // Physics
            const shape = new CANNON.Cylinder(CONFIG.WORLD.ISLAND_RADIUS, CONFIG.WORLD.ISLAND_RADIUS, 1, 32)
            const body = new CANNON.Body({ mass: 0, material: this.defaultMaterial })
            body.addShape(shape)
            body.position.set(pos.x, -0.5, pos.z)
            this.world.addBody(body)

            this.islands.push({ mesh, body, name: pos.name })
        })
    }

    createBridges() {
        const bridges = [
            { start: { x: 23, z: -60 }, end: { x: 51, z: -60 } },   // norte-este
            { start: { x: -23, z: -60 }, end: { x: -51, z: -60 } }, // norte-oeste
            { start: { x: 0, z: -24 }, end: { x: 0, z: -49 } },     // norte-central
            { start: { x: 0, z: 24 }, end: { x: 0, z: 49 } }        // sur-central
        ]

        bridges.forEach(bridge => {
            this.createBridge(bridge.start, bridge.end)
        })
    }

    createBridge(start, end) {
        const dx = end.x - start.x
        const dz = end.z - start.z
        const distance = Math.sqrt(dx * dx + dz * dz)
        const steps = Math.ceil(distance / CONFIG.WORLD.BRIDGE_PLANK_LENGTH)
        const angle = Math.atan2(dz, dx)

        const offsetX = Math.sin(angle) * CONFIG.WORLD.BRIDGE_SEPARATION
        const offsetZ = -Math.cos(angle) * CONFIG.WORLD.BRIDGE_SEPARATION

        for (let i = 0; i < steps; i++) {
            const t = i / steps
            const x = start.x + dx * t
            const z = start.z + dz * t
            const y = CONFIG.WORLD.BRIDGE_HEIGHT

            const sides = [-1, 1]
            for (let s = 0; s < sides.length; s++) {
                const side = sides[s]
                const px = x + offsetX * side
                const pz = z + offsetZ * side

                // Visual
                const geometry = this.geometryManager.getGeometry('bridge')
                const material = this.materialManager.getMaterial('bridge')
                const mesh = new THREE.Mesh(geometry, material)
                mesh.castShadow = true
                mesh.receiveShadow = true
                mesh.position.set(px, y, pz)
                mesh.rotation.y = -angle
                this.scene.add(mesh)

                // Physics
                const shape = new CANNON.Box(new CANNON.Vec3(
                    CONFIG.WORLD.BRIDGE_PLANK_LENGTH / 2,
                    CONFIG.WORLD.BRIDGE_HEIGHT / 2,
                    CONFIG.WORLD.BRIDGE_WIDTH / 2
                ))
                const body = new CANNON.Body({ mass: 0, material: this.defaultMaterial })
                body.addShape(shape)
                body.position.set(px, y, pz)
                body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -angle)
                this.world.addBody(body)
            }
        }
    }

    initCar() {
        // Visual car
        const carMesh = new THREE.Group()

        // Car body
        const baseGeometry = this.geometryManager.getGeometry('carBody')
        const baseMaterial = this.materialManager.getMaterial('car')
        const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial)
        baseMesh.position.y = CONFIG.CAR.HEIGHT / 2
        carMesh.add(baseMesh)

        // Car roof
        const roofGeometry = this.geometryManager.getGeometry('carRoof')
        const roofMesh = new THREE.Mesh(roofGeometry, baseMaterial)
        roofMesh.position.y = CONFIG.CAR.HEIGHT + 0.3
        carMesh.add(roofMesh)

        carMesh.castShadow = true
        carMesh.position.set(0, 1, 0)
        carMesh.rotation.y = Math.PI
        this.scene.add(carMesh)

        // Physics chassis
        const chassisShape = new CANNON.Box(new CANNON.Vec3(
            CONFIG.CAR.WIDTH / 2,
            CONFIG.CAR.HEIGHT / 2,
            CONFIG.CAR.LENGTH / 2
        ))
        const chassisBody = new CANNON.Body({ mass: CONFIG.CAR.MASS })
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
            radius: CONFIG.CAR.WHEEL_RADIUS,
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

        const halfWidth = CONFIG.CAR.WIDTH / 2
        const halfLength = CONFIG.CAR.LENGTH / 2

        vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(halfWidth, 0, halfLength) })
        vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(-halfWidth, 0, halfLength) })
        vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(halfWidth, 0, -halfLength) })
        vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(-halfWidth, 0, -halfLength) })

        vehicle.addToWorld(this.world)

        // Visual wheels
        const wheelMeshes = []
        vehicle.wheelInfos.forEach(wheel => {
            const wheelGeometry = this.geometryManager.getGeometry('wheel')
            const wheelMaterial = this.materialManager.getMaterial('wheel')
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

    initGameObjects() {
        this.createInstancedTowers()
        this.createScatteredObjects()
    }

    createInstancedTowers() {
        const central = this.islands.find(i => i.name === 'central')
        const corners = [
            { x: -CONFIG.INSTANCES.GROUP_OFFSET, z: -CONFIG.INSTANCES.GROUP_OFFSET },
            { x: CONFIG.INSTANCES.GROUP_OFFSET, z: -CONFIG.INSTANCES.GROUP_OFFSET },
            { x: -CONFIG.INSTANCES.GROUP_OFFSET, z: CONFIG.INSTANCES.GROUP_OFFSET },
            { x: CONFIG.INSTANCES.GROUP_OFFSET, z: CONFIG.INSTANCES.GROUP_OFFSET }
        ]

        const positions = []
        corners.forEach(corner => {
            for (let t = 0; t < CONFIG.INSTANCES.TOWERS_PER_GROUP; t++) {
                const offsetX = t * CONFIG.INSTANCES.TOWER_SPACING
                for (let k = 0; k < CONFIG.INSTANCES.TOWER_HEIGHT; k++) {
                    positions.push({
                        x: central.mesh.position.x + corner.x + offsetX,
                        y: 0.5 + k * CONFIG.INSTANCES.BOX_SIZE,
                        z: central.mesh.position.z + corner.z
                    })
                }
            }
        })

        this.instancedObjectManager.createInstancedBoxes(positions.length, positions)
    }

    createScatteredObjects() {
        // Norte - Bottles
        const norte = this.islands.find(i => i.name === 'norte')
        const bottleCols = 6
        const bottleRows = 3
        for (let i = 0; i < bottleCols; i++) {
            for (let j = 0; j < bottleRows; j++) {
                const offsetX = -3 + i * 1.2
                const offsetZ = -2
                const offsetY = 1 + j * 2
                this.gameObjectManager.createBottle(
                    norte.mesh.position.x + offsetX,
                    offsetY,
                    norte.mesh.position.z + offsetZ
                )
            }
        }

        // Este - Spheres
        const este = this.islands.find(i => i.name === 'este')
        for (let i = 0; i < 4; i++) {
            const offsetX = 0
            const offsetZ = -8 + i * 4
            const offsetY = 2
            this.gameObjectManager.createSphere(
                este.mesh.position.x + offsetX,
                offsetY,
                este.mesh.position.z + offsetZ,
                2
            )
        }

        // Oeste - Cones
        const oeste = this.islands.find(i => i.name === 'oeste')
        for (let i = 0; i < 6; i++) {
            const offsetX = 0
            const offsetZ = -5 + i * 2
            const offsetY = 1.5
            this.gameObjectManager.createCone(
                oeste.mesh.position.x + offsetX,
                offsetY,
                oeste.mesh.position.z + offsetZ,
                1,
                3
            )
        }

        // Sur - Mixed objects
        const sur = this.islands.find(i => i.name === 'sur')
        for (let i = 0; i < 3; i++) {
            const boxOffsetX = -2 + i * 2
            const boxOffsetY = 1
            this.gameObjectManager.createBox(
                sur.mesh.position.x + boxOffsetX,
                boxOffsetY,
                sur.mesh.position.z
            )

            const bottleOffsetX = 2 + i * 2
            const bottleOffsetY = 1
            this.gameObjectManager.createBottle(
                sur.mesh.position.x + bottleOffsetX,
                bottleOffsetY,
                sur.mesh.position.z
            )
        }
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

    updateCar(deltaTime) {
        if (!this.car) return

        let steer = 0
        if (this.keys.a) steer = CONFIG.CAR.MAX_STEER
        if (this.keys.d) steer = -CONFIG.CAR.MAX_STEER

        this.car.vehicle.setSteeringValue(steer, 0)
        this.car.vehicle.setSteeringValue(steer, 1)

        let engineForce = 0
        if (this.keys.w) engineForce = -CONFIG.CAR.MAX_FORCE
        if (this.keys.s) engineForce = CONFIG.CAR.MAX_FORCE

        this.car.vehicle.applyEngineForce(engineForce, 2)
        this.car.vehicle.applyEngineForce(engineForce, 3)

        if (!this.keys.w && !this.keys.s) {
            this.car.vehicle.setBrake(CONFIG.CAR.BRAKE_FORCE, 2)
            this.car.vehicle.setBrake(CONFIG.CAR.BRAKE_FORCE, 3)
        } else {
            this.car.vehicle.setBrake(0, 2)
            this.car.vehicle.setBrake(0, 3)
        }
    }

    updateCarVisuals() {
        if (!this.car) return

        // Update chassis
        this.car.mesh.position.copy(this.car.body.position)
        this.car.mesh.quaternion.copy(this.car.body.quaternion)

        // Update wheels
        this.car.vehicle.wheelInfos.forEach((wheel, index) => {
            this.car.vehicle.updateWheelTransform(index)
            const t = wheel.worldTransform
            const wheelMesh = this.car.wheels[index]

            wheelMesh.position.copy(t.position)

            const q = this.objectPool.getTempQuaternion()
            q.set(t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w)

            const correction = new THREE.Quaternion()
            correction.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
            q.multiply(correction)

            wheelMesh.quaternion.copy(q)
        })
    }

    updateCamera() {
        if (!this.car || !this.car.mesh) return

        const carPosition = this.car.mesh.position
        const speed = this.car.body.velocity.length()

        // Dynamic offset based on speed
        const dynamicOffset = this.cameraOffset.clone()
        dynamicOffset.z += Math.min(speed * CONFIG.CAMERA.DYNAMIC_OFFSET_MULT, CONFIG.CAMERA.MAX_DYNAMIC_OFFSET)

        const targetPosition = carPosition.clone().add(dynamicOffset)
        this.camera.position.lerp(targetPosition, CONFIG.CAMERA.FOLLOW_SPEED)
        this.camera.lookAt(carPosition)
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

        // Reset instanced objects
        if (this.instancedObjectManager) {
            this.instancedObjectManager.reset()
        }

        // Reset game objects
        if (this.gameObjectManager) {
            this.gameObjectManager.reset()
        }

        console.log('✅ Game reset complete!')
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate())

        const deltaTime = this.clock.getDelta()
        const clampedDeltaTime = Math.min(deltaTime, 1.0 / 30.0)

        // 🔹 Medición: empezar
        const frameStart = performance.now()

        // Update physics
        this.world.step(this.world.fixedTimeStep, clampedDeltaTime, this.world.maxSubSteps)

        // Update car
        this.updateCar(clampedDeltaTime)
        this.updateCarVisuals()

        // Update objects
        if (this.instancedObjectManager) this.instancedObjectManager.update()
        if (this.gameObjectManager) this.gameObjectManager.update()

        // Update camera
        this.updateCamera()

        // Render
        this.renderer.render(this.scene, this.camera)

        // 🔹 Medición: fin
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
        console.log('Starting optimized game engine...')
        console.log('Scene children:', this.scene.children.length)
        console.log('Camera position:', this.camera.position)
        this.animate()
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId)
        }

        // Cleanup managers
        if (this.instancedObjectManager) {
            this.instancedObjectManager.dispose()
        }
        if (this.gameObjectManager) {
            this.gameObjectManager.dispose()
        }
        if (this.materialManager) {
            this.materialManager.dispose()
        }
        if (this.geometryManager) {
            this.geometryManager.dispose()
        }

        // Cleanup renderer
        if (this.renderer) {
            this.renderer.dispose()
        }

        // Remove event listeners
        window.removeEventListener('keydown', this.handleKeyDown)
        window.removeEventListener('keyup', this.handleKeyUp)
        window.removeEventListener('resize', this.handleResize)

        console.log('GameEngine destroyed and cleaned up')
    }
}