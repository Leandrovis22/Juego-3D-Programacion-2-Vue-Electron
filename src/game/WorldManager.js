import * as THREE from 'three'
import * as CANNON from 'cannon-es'

export default class WorldManager {
    constructor(scene, world) {
        this.scene = scene
        this.world = world

        // Objects references
        this.box = null
        this.sphere = null
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

    resetObjects() {
        console.log('🔄 Resetting world objects...')

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

    }

}