import * as THREE from 'three'
import * as CANNON from 'cannon-es'

export default class WorldManager {
    constructor(scene, world) {
        this.scene = scene
        this.world = world

        // Objects arrays for better management
        this.objects = []
        this.stackedObjects = []
        this.towers = []

        // Materials library
        this.materials = {
            red: new THREE.MeshLambertMaterial({ color: 0xff6b6b }),
            blue: new THREE.MeshLambertMaterial({ color: 0x4fc3f7 }),
            green: new THREE.MeshLambertMaterial({ color: 0x66bb6a }),
            purple: new THREE.MeshLambertMaterial({ color: 0xab47bc }),
            orange: new THREE.MeshLambertMaterial({ color: 0xff9800 }),
            yellow: new THREE.MeshLambertMaterial({ color: 0xffeb3b }),
            pink: new THREE.MeshLambertMaterial({ color: 0xe91e63 }),
            cyan: new THREE.MeshLambertMaterial({ color: 0x00bcd4 }),
            wood: new THREE.MeshLambertMaterial({ color: 0x8d6e63 }),
            metal: new THREE.MeshLambertMaterial({ color: 0x607d8b })
        }
    }

    initWorld() {
        // Main island - bigger and more detailed
        const geometry = new THREE.CircleGeometry(60, 64)
        const material = new THREE.MeshLambertMaterial({ color: 0x55aa55 })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.rotation.x = -Math.PI / 2
        mesh.receiveShadow = true
        this.scene.add(mesh)

        // Physics ground
        const shape = new CANNON.Cylinder(60, 60, 1, 32)
        const body = new CANNON.Body({ mass: 0 })
        body.addShape(shape)
        body.position.set(0, -0.5, 0)
        this.world.addBody(body)

        // Add some decorative rocks around the island
        this.createRocks()
    }

    createRocks() {
        const rockPositions = [
            { x: 45, z: 20 }, { x: -40, z: 25 }, { x: 30, z: -35 },
            { x: -35, z: -20 }, { x: 20, z: 40 }, { x: -25, z: 35 }
        ]

        rockPositions.forEach(pos => {
            const size = Math.random() * 2 + 1
            const rockGeom = new THREE.SphereGeometry(size, 8, 6)
            const rockMat = new THREE.MeshLambertMaterial({ color: 0x666666 })
            const rockMesh = new THREE.Mesh(rockGeom, rockMat)
            rockMesh.position.set(pos.x, size * 0.3, pos.z)
            rockMesh.castShadow = true
            rockMesh.receiveShadow = true
            this.scene.add(rockMesh)

            // Physics body for rock
            const rockShape = new CANNON.Sphere(size)
            const rockBody = new CANNON.Body({ mass: 0 }) // mass: 0 = static
            rockBody.addShape(rockShape)
            rockBody.position.set(pos.x, size * 0.3, pos.z)
            this.world.addBody(rockBody)
        })

    }

    initObjects() {
        // Clear existing objects
        this.clearAllObjects()

        this.createBox({ x: -10, y: 3.5, z: -10 }, { width: 1, height: 1, depth: 1 }, this.materials.yellow)
        this.createBox({ x: 10, y: 3.5, z: -10 }, { width: 1, height: 1, depth: 1 }, this.materials.orange)
        this.createBox({ x: -10, y: 3.5, z: 10 }, { width: 1, height: 1, depth: 1 }, this.materials.blue)
        this.createBox({ x: 10, y: 3.5, z: 10 }, { width: 1, height: 1, depth: 1 }, this.materials.red)

        // Create various individual objects
        this.createBoxTower({ x: 10, z: 0 }, 5)
        this.createMixedTower({ x: -10, z: 0 }, 4)
        this.createPyramid({ x: 0, z: 15 }, 4)
        this.createWall({ x: -20, z: -10 }, 6, 3)

        // Scattered objects for interaction
        this.createScatteredObjects()

        // Special objects
        this.createDominoes({ x: 15, z: -15 }, 8)
        this.createBarrels({ x: -15, z: 15 }, 3)
    }

    createBoxTower(position, height) {
        const tower = []
        for (let i = 0; i < height; i++) {
            const obj = this.createBox({
                x: position.x,
                y: 0.5 + i * 1.1,
                z: position.z
            }, {
                width: 1,
                height: 1,
                depth: 1
            }, this.getRandomMaterial())

            tower.push(obj)
            this.stackedObjects.push(obj)
        }
        this.towers.push(tower)
    }

    createMixedTower(position, height) {
        const tower = []
        const shapes = ['box', 'cylinder']

        for (let i = 0; i < height - 1; i++) {
            const shape = shapes[i % shapes.length]
            let obj

            switch (shape) {
                case 'box':
                    obj = this.createBox({
                        x: position.x,
                        y: 0.5 + i * 1.2,
                        z: position.z
                    }, { width: 1, height: 1, depth: 1 }, this.getRandomMaterial())
                    break
                case 'cylinder':
                    obj = this.createCylinder({
                        x: position.x,
                        y: 0.5 + i * 1.2,
                        z: position.z
                    }, { radius: 0.5, height: 1 }, this.getRandomMaterial())
                    break
            }

            tower.push(obj)
            this.stackedObjects.push(obj)
        }

        // Add a single sphere at the top
        const sphere = this.createSphere({
            x: position.x,
            y: 0.8 + height * 1.2,
            z: position.z
        }, 0.6, this.getRandomMaterial())
        tower.push(sphere)
        this.stackedObjects.push(sphere)

        this.towers.push(tower)
    }

    createPyramid(position, levels) {
        const pyramid = []
        let currentY = 0.5

        for (let level = 0; level < levels; level++) {
            const size = levels - level
            const offset = (size - 1) * 0.6

            for (let x = 0; x < size; x++) {
                for (let z = 0; z < size; z++) {
                    const obj = this.createBox({
                        x: position.x + (x * 1.2) - offset,
                        y: currentY,
                        z: position.z + (z * 1.2) - offset
                    }, { width: 1, height: 1, depth: 1 }, this.getRandomMaterial())

                    pyramid.push(obj)
                    this.stackedObjects.push(obj)
                }
            }
            currentY += 1.1
        }
        this.towers.push(pyramid)
    }

    createWall(position, width, height) {
        const wall = []

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const obj = this.createBox({
                    x: position.x + x * 1.1,
                    y: 0.5 + y * 1.1,
                    z: position.z
                }, { width: 1, height: 1, depth: 1 }, this.materials.wood)

                wall.push(obj)
                this.stackedObjects.push(obj)
            }
        }
        this.towers.push(wall)
    }

    createDominoes(position, count) {
        const dominoes = []

        for (let i = 0; i < count; i++) {
            const obj = this.createBox({
                x: position.x + i * 2,
                y: 1.5,
                z: position.z
            }, { width: 0.2, height: 3, depth: 1 }, this.materials.wood)

            dominoes.push(obj)
            this.stackedObjects.push(obj)
        }
        this.towers.push(dominoes)
    }

    createBarrels(position, count) {
        const barrels = []

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2
            const radius = 3

            const obj = this.createCylinder({
                x: position.x + Math.cos(angle) * radius,
                y: 1,
                z: position.z + Math.sin(angle) * radius
            }, { radius: 0.8, height: 2 }, this.materials.wood)

            barrels.push(obj)
            this.stackedObjects.push(obj)
        }
        this.towers.push(barrels)
    }

    createScatteredObjects() {
        // Random scattered objects for interaction
        const scatterPositions = [
            { x: 25, z: 5 }, { x: -25, z: -5 }, { x: 5, z: 25 },
            { x: -5, z: -25 }, { x: 30, z: -20 }, { x: -30, z: 20 }
        ]

        scatterPositions.forEach(pos => {
            const shapes = ['box', 'sphere', 'cylinder']
            const shape = shapes[Math.floor(Math.random() * shapes.length)]

            switch (shape) {
                case 'box':
                    this.createBox({
                        x: pos.x + (Math.random() - 0.5) * 4,
                        y: 1,
                        z: pos.z + (Math.random() - 0.5) * 4
                    }, { width: 1, height: 1, depth: 1 }, this.getRandomMaterial())
                    break
                case 'sphere':
                    this.createSphere({
                        x: pos.x + (Math.random() - 0.5) * 4,
                        y: 1,
                        z: pos.z + (Math.random() - 0.5) * 4
                    }, 0.8, this.getRandomMaterial())
                    break
                case 'cylinder':
                    this.createCylinder({
                        x: pos.x + (Math.random() - 0.5) * 4,
                        y: 1,
                        z: pos.z + (Math.random() - 0.5) * 4
                    }, { radius: 0.6, height: 1.5 }, this.getRandomMaterial())
                    break
            }
        })
    }

    createBox(position, size, material) {
        // Visual mesh
        const geometry = new THREE.BoxGeometry(size.width, size.height, size.depth)
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(position.x, position.y, position.z)
        mesh.castShadow = true
        mesh.receiveShadow = true
        this.scene.add(mesh)

        // Physics body
        const shape = new CANNON.Box(new CANNON.Vec3(size.width / 2, size.height / 2, size.depth / 2))
        const body = new CANNON.Body({ mass: 1 })
        body.addShape(shape)
        body.position.set(position.x, position.y, position.z)
        this.world.addBody(body)

        const obj = { mesh, body, type: 'box' }
        this.objects.push(obj)
        return obj
    }

    createSphere(position, radius, material) {
        // Visual mesh
        const geometry = new THREE.SphereGeometry(radius, 16, 16)
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(position.x, position.y, position.z)
        mesh.castShadow = true
        mesh.receiveShadow = true
        this.scene.add(mesh)

        // Physics body
        const shape = new CANNON.Sphere(radius)
        const body = new CANNON.Body({ mass: 1 })
        body.addShape(shape)
        body.position.set(position.x, position.y, position.z)
        this.world.addBody(body)

        const obj = { mesh, body, type: 'sphere' }
        this.objects.push(obj)
        return obj
    }

    createCylinder(position, size, material) {
        // Visual mesh
        const geometry = new THREE.CylinderGeometry(size.radius, size.radius, size.height, 16)
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(position.x, position.y, position.z)
        mesh.castShadow = true
        mesh.receiveShadow = true
        this.scene.add(mesh)

        // Physics body
        const shape = new CANNON.Cylinder(size.radius, size.radius, size.height, 8)
        const body = new CANNON.Body({ mass: 1 })
        body.addShape(shape)
        body.position.set(position.x, position.y, position.z)
        this.world.addBody(body)

        const obj = { mesh, body, type: 'cylinder' }
        this.objects.push(obj)
        return obj
    }

    getRandomMaterial() {
        const materialKeys = Object.keys(this.materials)
        const randomKey = materialKeys[Math.floor(Math.random() * materialKeys.length)]
        return this.materials[randomKey]
    }

    updateObjects() {
        // Update all objects
        this.objects.forEach(obj => {
            obj.mesh.position.copy(obj.body.position)
            obj.mesh.quaternion.copy(obj.body.quaternion)
        })
    }

    resetObjects() {
        // Clear all objects first
        this.clearAllObjects()
        // Recreate everything
        this.initObjects()
    }

    clearAllObjects() {
        // Remove from scene and physics world
        this.objects.forEach(obj => {
            this.scene.remove(obj.mesh)
            this.world.removeBody(obj.body)
        })

        // Clear arrays
        this.objects = []
        this.stackedObjects = []
        this.towers = []
    }

}