import * as THREE from '../node_modules/three/build/three.module.js';
import { GUI } from '../node_modules/three/examples/jsm/libs/lil-gui.module.min.js';
import World from './World.js';
import CDTFactory from './cdt.js';

/** The fundamental set up and animation structures for Simulation */
export default class Main {
    constructor() {
        // Intercept Main Window Errors
        window.realConsoleError = console.error;
        window.addEventListener('error', (event) => {
            let path = event.filename.split("/");
            this.display((path[path.length - 1] + ":" + event.lineno + " - " + event.message));
        });
        console.error = this.fakeError.bind(this);
        this.timeMS = 0;
        this.deferredConstructor();
    }

    async deferredConstructor() {
        // Configure Settings
        this.simulationParams = {
        };
        this.gui = new GUI();
        //this.gui.add(this.simulationParams, 'numViews', 1, 10, 1).name('Number of Views')           .onChange((value) => { this.physicalCamera.numViews      = value; this.physicalCamera.setupCamera(); });
        //this.gui.add(this.simulationParams, 'resolution', 256, 4096, 256).name('Resolution')        .onChange((value) => { this.physicalCamera.resolution    = value; this.physicalCamera.setupCamera(); });
        //this.gui.add(this.simulationParams, 'aperture', 0.0, 0.1, 0.01).name('Aperture Size')       .onChange((value) => { this.physicalCamera.aperture      = value; this.physicalCamera.setupCamera(); });
        //this.gui.add(this.simulationParams, 'focalDistance', 0.4, 5.0, 0.01).name('Focal Distance').onChange((value) => { this.physicalCamera.focalDistance = value; this.physicalCamera.setupCamera(); });

        // Initialize the CDT Runtime
        this.CDT = await CDTFactory();

        // Construct the render world
        this.world = new World(this);

        let torusGeometry = new THREE.TorusKnotGeometry( ...Object.values( {
				radius: 0.12,
				tube: 0.04,
				tubularSegments: 30,
				radialSegments: 5,
				p: 2,
				q: 3,
				thickness: 0.1
			} ) );
		let torusMaterial = new THREE.MeshPhysicalMaterial( {
			transmission: 0.0, roughness: 1.0, metalness: 0.25, thickness: 0.5, side: THREE.DoubleSide
		} );
		let torus = new THREE.Mesh( torusGeometry, torusMaterial );
		torus.position.set( 0, 0.25, 0 );
		//this.world.scene.add( torus );

        let triangles = torusGeometry.index.array;
        let vertices  = torusGeometry.attributes.position.array;
        let result = this.CDT.computeCDT(vertices, triangles);
        console.log("CDT Result: ", result);

        let tetGeometry = new THREE.BufferGeometry();
        let tetScale = 0.8;

        let vertexColors = [];
        let modifiedVertices = [];
        for (let i = 0; i < result.tetrahedra.length; i += 4) {
            // Get the average position of the tetrahedron vertices
            let avgX = (result.vertices[result.tetrahedra[i    ] * 3    ] + result.vertices[result.tetrahedra[i + 1] * 3    ] +
                        result.vertices[result.tetrahedra[i + 2] * 3    ] + result.vertices[result.tetrahedra[i + 3] * 3    ]) / 4;
            let avgY = (result.vertices[result.tetrahedra[i    ] * 3 + 1] + result.vertices[result.tetrahedra[i + 1] * 3 + 1] +
                        result.vertices[result.tetrahedra[i + 2] * 3 + 1] + result.vertices[result.tetrahedra[i + 3] * 3 + 1]) / 4;
            let avgZ = (result.vertices[result.tetrahedra[i    ] * 3 + 2] + result.vertices[result.tetrahedra[i + 1] * 3 + 2] +
                        result.vertices[result.tetrahedra[i + 2] * 3 + 2] + result.vertices[result.tetrahedra[i + 3] * 3 + 2]) / 4;

            // Subtract the average position from each vertex of the tetrahedron
            let v00 = ((result.vertices[result.tetrahedra[i    ] * 3    ] - avgX)*tetScale)+avgX;
            let v01 = ((result.vertices[result.tetrahedra[i    ] * 3 + 1] - avgY)*tetScale)+avgY;
            let v02 = ((result.vertices[result.tetrahedra[i    ] * 3 + 2] - avgZ)*tetScale)+avgZ;
            let v10 = ((result.vertices[result.tetrahedra[i + 1] * 3    ] - avgX)*tetScale)+avgX;
            let v11 = ((result.vertices[result.tetrahedra[i + 1] * 3 + 1] - avgY)*tetScale)+avgY;
            let v12 = ((result.vertices[result.tetrahedra[i + 1] * 3 + 2] - avgZ)*tetScale)+avgZ;
            let v20 = ((result.vertices[result.tetrahedra[i + 2] * 3    ] - avgX)*tetScale)+avgX;
            let v21 = ((result.vertices[result.tetrahedra[i + 2] * 3 + 1] - avgY)*tetScale)+avgY;
            let v22 = ((result.vertices[result.tetrahedra[i + 2] * 3 + 2] - avgZ)*tetScale)+avgZ;
            let v30 = ((result.vertices[result.tetrahedra[i + 3] * 3    ] - avgX)*tetScale)+avgX;
            let v31 = ((result.vertices[result.tetrahedra[i + 3] * 3 + 1] - avgY)*tetScale)+avgY;
            let v32 = ((result.vertices[result.tetrahedra[i + 3] * 3 + 2] - avgZ)*tetScale)+avgZ;

            // Fit a plane to the first 3 vertices of the tetrahedron
            let plane = new THREE.Plane().setFromCoplanarPoints(
                new THREE.Vector3(v00, v01, v02),
                new THREE.Vector3(v10, v11, v12),
                new THREE.Vector3(v20, v21, v22)
            );
            // Calculate the distance from the fourth vertex to the plane
            let distance = Math.abs(plane.distanceToPoint(new THREE.Vector3(v30, v31, v32)));
            if (distance < 0.001) { continue;}

            // Generate a random vertex color
            let color = new THREE.Color(Math.random(), Math.random(), Math.random());
            for(let j = 0; j < 12; j++) {
                vertexColors.push(color.r, color.g, color.b);
            }

            // Push the modified vertices into the array as four triangles
            modifiedVertices.push(v00, v01, v02, v10, v11, v12, v20, v21, v22);
            modifiedVertices.push(v20, v21, v22, v30, v31, v32, v00, v01, v02);
            modifiedVertices.push(v30, v31, v32, v10, v11, v12, v00, v01, v02);
            modifiedVertices.push(v30, v31, v32, v20, v21, v22, v10, v11, v12);

        }
        tetGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(modifiedVertices), 3));
        tetGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertexColors), 3));
        let tetrahedraMesh = new THREE.Mesh(tetGeometry, new THREE.MeshPhysicalMaterial({ color: 0xffffff, wireframe: false, side: THREE.DoubleSide, vertexColors: true }));
        tetGeometry.computeVertexNormals();

        tetrahedraMesh.position.set(0, 0.3, 0);
        this.world.scene.add(tetrahedraMesh);
    }

    /** Update the simulation */
    update(timeMS) {
        this.deltaTime = timeMS - this.timeMS;
        this.timeMS = timeMS;
        this.world.controls.update();
        this.world.renderer.render(this.world.scene, this.world.camera);
        this.world.stats.update();
    }

    // Log Errors as <div>s over the main viewport
    fakeError(...args) {
        if (args.length > 0 && args[0]) { this.display(JSON.stringify(args[0])); }
        window.realConsoleError.apply(console, arguments);
    }

    display(text) {
        let errorNode = window.document.createElement("div");
        errorNode.innerHTML = text.fontcolor("red");
        window.document.getElementById("info").appendChild(errorNode);
    }
}

var main = new Main();
window.main = main;
