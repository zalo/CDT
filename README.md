# CDT WebAssembly Bindings

WebAssembly bindings for the CDT (Constrained Delaunay Tetrahedrization) library.

## Usage

```javascript
import CDT from 'cdt-wasm';

// Example: tetrahedralize a cube
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

const result = CDT.computeCDT(vertices, triangles);

if (result.success) {
  console.log('Tetrahedrization succeeded!');
  console.log(`Generated ${result.numTetrahedra} tetrahedra`);
  console.log(`Added ${result.numSteinerVertices} Steiner points`);
}
```

## API

See the TypeScript definitions in `cdt.d.ts` for complete API documentation.
