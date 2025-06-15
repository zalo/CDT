# CDT WebAssembly Bindings

This directory contains WebAssembly bindings for the CDT (Constrained Delaunay Tetrahedrization) library, making the powerful mesh processing capabilities available in JavaScript and TypeScript environments.

## Features

- **Constrained Delaunay Tetrahedrization**: Convert 3D surface triangulations into volumetric tetrahedral meshes
- **Steiner Point Insertion**: Automatically adds points as needed to maintain mesh quality
- **WebAssembly Performance**: Near-native speed in web browsers and Node.js
- **TypeScript Support**: Complete type definitions included
- **ES Module**: Modern JavaScript module format

## Installation

The WebAssembly bindings are automatically built by GitHub Actions and can be downloaded as artifacts. In the future, these will be published to npm.

## Usage

### Basic Example

```javascript
import CDT from './cdt.js';

// Define a simple cube
const vertices = [
  0, 0, 0,  // vertex 0
  1, 0, 0,  // vertex 1  
  1, 1, 0,  // vertex 2
  0, 1, 0,  // vertex 3
  0, 0, 1,  // vertex 4
  1, 0, 1,  // vertex 5
  1, 1, 1,  // vertex 6
  0, 1, 1   // vertex 7
];

const triangles = [
  0, 1, 2, 2, 3, 0,  // bottom face
  4, 7, 6, 6, 5, 4,  // top face  
  0, 4, 5, 5, 1, 0,  // front face
  2, 6, 7, 7, 3, 2,  // back face
  0, 3, 7, 7, 4, 0,  // left face
  1, 5, 6, 6, 2, 1   // right face
];

// Compute tetrahedralization
const result = CDT.computeCDTWithOptions(vertices, triangles, false, false);

if (result.success) {
  console.log(`Generated ${result.numTetrahedra} tetrahedra`);
  console.log(`Added ${result.numSteinerVertices} Steiner points`);
  
  // Access tetrahedra
  for (let i = 0; i < result.numTetrahedra; i++) {
    const v0 = result.tetrahedra[i * 4];
    const v1 = result.tetrahedra[i * 4 + 1]; 
    const v2 = result.tetrahedra[i * 4 + 2];
    const v3 = result.tetrahedra[i * 4 + 3];
    console.log(`Tet ${i}: vertices ${v0}, ${v1}, ${v2}, ${v3}`);
  }
}
```

### Advanced Usage

```javascript
// Validate input before processing
const info = CDT.validateMesh(vertices, triangles);
if (!info.valid) {
  console.error('Invalid mesh input');
  return;
}

// Add bounding box and enable verbose output
const result = CDT.computeCDT(vertices, triangles, true, true);

// Check if input forms a valid polyhedron
if (result.isPolyhedron) {
  console.log('Input is a closed polyhedron');
} else {
  console.log('Input is an open surface');
}
```

## API Reference

### Functions

#### `computeCDTWithOptions(vertices, triangles, addBoundingBox, verbose)`

Computes the Constrained Delaunay Tetrahedrization with full options.

**Parameters:**
- `vertices: number[]` - Vertex coordinates as [x1,y1,z1, x2,y2,z2, ...]
- `triangles: number[]` - Triangle vertex indices as [t1_v1,t1_v2,t1_v3, t2_v1,...]
- `addBoundingBox: boolean` - Whether to add bounding box vertices
- `verbose: boolean` - Enable verbose console output

**Returns:** `CDTResult`

#### `computeCDT(vertices, triangles)`

Simplified version with default options (no bounding box, no verbose output).

**Parameters:**
- `vertices: number[]` - Vertex coordinates
- `triangles: number[]` - Triangle vertex indices

**Returns:** `CDTResult`

#### `validateMesh(vertices, triangles)`

Validates input mesh data.

**Parameters:**
- `vertices: number[]` - Vertex coordinates
- `triangles: number[]` - Triangle vertex indices

**Returns:** `MeshInfo`

### Types

#### `CDTResult`

```typescript
interface CDTResult {
  vertices: number[];          // All vertices including Steiner points [x,y,z,...]
  tetrahedra: number[];        // Tetrahedron vertex indices [v1,v2,v3,v4,...]
  numInputVertices: number;    // Number of original input vertices
  numSteinerVertices: number;  // Number of added Steiner points
  numTetrahedra: number;       // Total number of tetrahedra
  isPolyhedron: boolean;       // Whether input forms closed polyhedron
  success: boolean;            // Whether computation succeeded
}
```

#### `MeshInfo`

```typescript
interface MeshInfo {
  numVertices: number;   // Number of vertices in input
  numTriangles: number;  // Number of triangles in input
  valid: boolean;        // Whether input is valid
}
```

## Building

### Prerequisites

- [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html)
- CMake 3.10+
- C++20 compatible compiler

### Build Commands

```bash
# Build WebAssembly module (LGPL mode)
mkdir build-emscripten
cd build-emscripten
emcmake cmake .. -DEMSCRIPTEN=ON -DLGPL=ON
emmake make -j4

# Build native version (LGPL mode for comparison/testing)
mkdir build-native  
cd build-native
cmake .. -DLGPL=ON
make -j4
```

## Algorithm Details

The CDT algorithm implemented here is based on:

> "Constrained Delaunay Tetrahedrization: A robust and practical approach" by L. Diazzi, D. Panozzo, A. Vaxman and M. Attene (ACM Trans Graphics Vol 42, N. 6, Procs of SIGGRAPH Asia 2023).

Key features:
- Handles non-convex and non-manifold inputs
- Inserts Steiner points only when necessary
- Maintains geometric and topological constraints
- Produces high-quality tetrahedral meshes

## License

This WebAssembly binding is built in LGPL mode:
- **LGPL-3.0** - More permissive licensing suitable for web distribution
- Uses slightly slower algorithms compared to GPL mode, but provides better licensing compatibility
- To build in GPL mode (faster but more restrictive), use `-DLGPL=OFF` during build

## Contributing

Contributions are welcome! Please ensure that:
1. New features are covered by tests
2. Code follows the existing style
3. WebAssembly bindings remain minimal and focused
4. TypeScript definitions are kept up to date