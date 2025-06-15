// TypeScript definitions for CDT (Constrained Delaunay Tetrahedrization)

declare module 'cdt-wasm' {
  export interface CDTResult {
    vertices: number[];      // Vertex coordinates: [x1,y1,z1, x2,y2,z2, ...]
    tetrahedra: number[];    // Tetrahedron vertex indices: [t1_v1,t1_v2,t1_v3,t1_v4, t2_v1,...]
    numInputVertices: number;     // Number of original input vertices
    numSteinerVertices: number;   // Number of Steiner points added
    numTetrahedra: number;        // Total number of tetrahedra
    isPolyhedron: boolean;        // Whether input forms a valid polyhedron
    success: boolean;             // Whether computation succeeded
  }

  export interface MeshInfo {
    numVertices: number;     // Number of vertices in input
    numTriangles: number;    // Number of triangles in input  
    valid: boolean;          // Whether input is valid
  }

  /**
   * Compute Constrained Delaunay Tetrahedrization
   * @param vertices Array of vertex coordinates [x1,y1,z1, x2,y2,z2, ...]
   * @param triangles Array of triangle vertex indices [t1_v1,t1_v2,t1_v3, t2_v1,...]
   * @param addBoundingBox Whether to add a bounding box around the input
   * @param verbose Whether to enable verbose output
   * @returns CDT result containing tetrahedrization
   */
  export function computeCDT(
    vertices: number[], 
    triangles: number[], 
    addBoundingBox?: boolean, 
    verbose?: boolean
  ): CDTResult;

  /**
   * Validate input mesh data
   * @param vertices Array of vertex coordinates
   * @param triangles Array of triangle vertex indices
   * @returns Mesh validation info
   */
  export function validateMesh(vertices: number[], triangles: number[]): MeshInfo;

  // Vector types (for advanced usage)
  export class VectorDouble {
    constructor();
    size(): number;
    get(index: number): number;
    set(index: number, value: number): void;
    push_back(value: number): void;
  }

  export class VectorUint32 {
    constructor();
    size(): number;
    get(index: number): number;
    set(index: number, value: number): void;
    push_back(value: number): void;
  }

  // Module interface
  export interface CDTModule {
    computeCDT: typeof computeCDT;
    validateMesh: typeof validateMesh;
    VectorDouble: typeof VectorDouble;
    VectorUint32: typeof VectorUint32;
  }

  const CDT: CDTModule;
  export default CDT;
}