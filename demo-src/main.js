import * as THREE from '../node_modules/three/build/three.module.js';
import { GUI } from '../node_modules/three/examples/jsm/libs/lil-gui.module.min.js';
import { OBJLoader } from '../node_modules/three/examples/jsm/loaders/OBJLoader.js';
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
        // Initialize the CDT Runtime
        this.CDT = await CDTFactory();

        // Initialize OBJ loader
        this.objLoader = new OBJLoader();

        // Construct the render world
        this.world = new World(this);

        // Configure Settings
        this.simulationParams = {
            addBoundingBox: false,
            verbose: false,
            tetScale: 0.8,
            wireframe: false
        };

        // Initialize with default torus knot geometry
        this.currentGeometry = this.createTorusKnotGeometry();
        this.currentMesh = null; // Will hold the current tetrahedra mesh

        // Setup GUI
        this.setupGUI();

        // Compute and visualize initial tetrahedrization
        this.computeAndVisualizeCDT();
    }

    createTorusKnotGeometry() {
        return new THREE.TorusKnotGeometry( ...Object.values( {
            radius: 0.12,
            tube: 0.04,
            tubularSegments: 30,
            radialSegments: 5,
            p: 2,
            q: 3,
            thickness: 0.1
        } ) );
    }

    setupGUI() {
        this.gui = new GUI();
        
        // CDT Parameters folder
        const cdtFolder = this.gui.addFolder('CDT Parameters');
        cdtFolder.add(this.simulationParams, 'addBoundingBox').name('Add Bounding Box').onChange(() => this.computeAndVisualizeCDT());
        cdtFolder.add(this.simulationParams, 'verbose').name('Verbose Output').onChange(() => this.computeAndVisualizeCDT());
        cdtFolder.add(this.simulationParams, 'tetScale', 0.1, 1.5, 0.1).name('Tetrahedra Scale').onChange(() => this.computeAndVisualizeCDT());
        cdtFolder.add(this.simulationParams, 'wireframe').name('Wireframe Mode').onChange(() => this.computeAndVisualizeCDT());
        cdtFolder.open();

        // Mesh Controls folder
        const meshFolder = this.gui.addFolder('Mesh Controls');
        
        // Add file upload button
        const uploadButton = { uploadMesh: () => this.uploadMeshFile() };
        meshFolder.add(uploadButton, 'uploadMesh').name('Upload Mesh File');
        
        // Add reset to default button
        const resetButton = { resetToDefault: () => this.resetToDefaultGeometry() };
        meshFolder.add(resetButton, 'resetToDefault').name('Reset to Torus Knot');
        meshFolder.open();
    }

    computeAndVisualizeCDT() {
        // Remove existing mesh if present
        if (this.currentMesh) {
            this.world.scene.remove(this.currentMesh);
            this.currentMesh = null;
        }

        // Show processing message
        console.log("Computing CDT...");

        try {
            // Extract vertices and triangles from current geometry
            let triangles = this.currentGeometry.index.array;
            let vertices = this.currentGeometry.attributes.position.array;
            
            // Compute CDT with current parameters
            let result;
            if (this.simulationParams.addBoundingBox || this.simulationParams.verbose) {
                result = this.CDT.computeCDTWithOptions(
                    vertices, 
                    triangles, 
                    this.simulationParams.addBoundingBox, 
                    this.simulationParams.verbose
                );
            } else {
                result = this.CDT.computeCDT(vertices, triangles);
            }
            
            console.log("CDT Result: ", result);

            if (!result.success) {
                console.error("CDT computation failed");
                this.display("CDT computation failed");
                return;
            }

            // Create tetrahedra visualization
            this.visualizeTetrahedra(result);
            console.log(`Generated ${result.numTetrahedra} tetrahedra from ${result.numInputVertices} input vertices (${result.numSteinerVertices} Steiner points added)`);
            
        } catch (error) {
            console.error("Error during CDT computation:", error);
            this.display("Error during CDT computation: " + error.message);
        }
    }

    visualizeTetrahedra(result) {
        let tetGeometry = new THREE.BufferGeometry();
        let tetScale = this.simulationParams.tetScale;

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
        
        let material = new THREE.MeshPhysicalMaterial({ 
            color: 0xffffff, 
            wireframe: this.simulationParams.wireframe, 
            side: THREE.DoubleSide, 
            vertexColors: true 
        });
        
        this.currentMesh = new THREE.Mesh(tetGeometry, material);
        tetGeometry.computeVertexNormals();
        this.currentMesh.position.set(0, 0.3, 0);
        this.world.scene.add(this.currentMesh);
    }

    uploadMeshFile() {
        // Create file input element
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.obj,.ply,.stl';
        input.style.display = 'none';
        
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                this.loadMeshFromFile(file);
            }
        };
        
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
    }

    loadMeshFromFile(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            const geometry = this.parseMeshFile(file.name, content);
            if (geometry) {
                this.currentGeometry = geometry;
                this.computeAndVisualizeCDT();
            } else {
                alert('Failed to parse mesh file. Supported formats: OBJ');
            }
        };
        reader.readAsText(file);
    }

    parseMeshFile(filename, content) {
        const extension = filename.toLowerCase().split('.').pop();
        
        switch (extension) {
            case 'obj':
                return this.parseOBJWithLoader(content);
            default:
                console.error('Unsupported file format:', extension);
                return null;
        }
    }

    parseOBJWithLoader(content) {
        try {
            // Use three.js OBJLoader to parse the content
            const group = this.objLoader.parse(content);
            
            // Extract the first mesh from the group
            let mesh = null;
            group.traverse((child) => {
                if (child instanceof THREE.Mesh && !mesh) {
                    mesh = child;
                }
            });
            
            if (!mesh || !mesh.geometry) {
                console.error('No valid mesh found in OBJ file');
                return null;
            }
            
            // Get the geometry from the mesh
            let geometry = mesh.geometry;
            
            // If the geometry doesn't have indices, we need to create them
            if (!geometry.index) {
                const positions = geometry.attributes.position.array;
                const vertices = [];
                const indices = [];
                const vertexMap = new Map();
                
                // Create unique vertices and indices by comparing vertex positions
                for (let i = 0; i < positions.length; i += 3) {
                    const x = positions[i];
                    const y = positions[i + 1];
                    const z = positions[i + 2];
                    const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
                    
                    let vertexIndex = vertexMap.get(key);
                    if (vertexIndex === undefined) {
                        vertexIndex = vertices.length / 3;
                        vertices.push(x, y, z);
                        vertexMap.set(key, vertexIndex);
                    }
                    indices.push(vertexIndex);
                }
                
                // Create new indexed geometry
                const indexedGeometry = new THREE.BufferGeometry();
                indexedGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
                indexedGeometry.setIndex(indices);
                indexedGeometry.computeVertexNormals();
                
                return indexedGeometry;
            }
            
            // Ensure normals are computed
            if (!geometry.attributes.normal) {
                geometry.computeVertexNormals();
            }
            
            return geometry;
            
        } catch (error) {
            console.error('Error parsing OBJ file:', error);
            return null;
        }
    }

    resetToDefaultGeometry() {
        this.currentGeometry = this.createTorusKnotGeometry();
        this.computeAndVisualizeCDT();
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
