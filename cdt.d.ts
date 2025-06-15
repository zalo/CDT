// TypeScript definitions for CDT (Constrained Delaunay Tetrahedrization)

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
 * Compute Constrained Delaunay Tetrahedrization (simplified version)
 * @param vertices Array of vertex coordinates [x1,y1,z1, x2,y2,z2, ...]
 * @param triangles Array of triangle vertex indices [t1_v1,t1_v2,t1_v3, t2_v1,...]
 * @returns CDT result containing tetrahedrization
 */
export function computeCDT(
  vertices: number[], 
  triangles: number[]
): CDTResult;

/**
 * Compute Constrained Delaunay Tetrahedrization with full options
 * @param vertices Array of vertex coordinates [x1,y1,z1, x2,y2,z2, ...]
 * @param triangles Array of triangle vertex indices [t1_v1,t1_v2,t1_v3, t2_v1,...]
 * @param addBoundingBox Whether to add a bounding box around the input
 * @param verbose Whether to enable verbose output
 * @returns CDT result containing tetrahedrization
 */
export function computeCDTWithOptions(
  vertices: number[], 
  triangles: number[], 
  addBoundingBox: boolean, 
  verbose: boolean
): CDTResult;

/**
 * Validate input mesh data
 * @param vertices Array of vertex coordinates
 * @param triangles Array of triangle vertex indices
 * @returns Mesh validation info
 */
export function validateMesh(vertices: number[], triangles: number[]): MeshInfo;

/**
 * Simple test function to verify bindings work
 * @param a First number
 * @param b Second number
 * @returns Sum of a and b
 */
export function testFunction(a: number, b: number): number;

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
  computeCDTWithOptions: typeof computeCDTWithOptions;
  validateMesh: typeof validateMesh;
  testFunction: typeof testFunction;
  VectorDouble: typeof VectorDouble;
  VectorUint32: typeof VectorUint32;
}

// Module factory function (returned by Emscripten with MODULARIZE=1)
export interface CDTFactory {
  (): Promise<CDTModule>;
}

declare const CDTFactory: CDTFactory;
export default CDTFactory;