#include <vector>
#include <string>
#include <iostream>
#include "delaunay.h"
#include "inputPLC.h"
#include "PLC.h"
#include "numerics.h"

using namespace std;

// Simplified CDT result structure (for testing without emscripten)
struct CDTResult {
    std::vector<double> vertices;  // x1,y1,z1,x2,y2,z2,...
    std::vector<uint32_t> tetrahedra; // t1_v1,t1_v2,t1_v3,t1_v4,t2_v1,t2_v2,...
    uint32_t numInputVertices;
    uint32_t numSteinerVertices;
    uint32_t numTetrahedra;
    bool isPolyhedron;
    bool success;
    
    CDTResult() : numInputVertices(0), numSteinerVertices(0), numTetrahedra(0), 
                  isPolyhedron(false), success(false) {}
};

// Test the CDT computation logic
CDTResult testComputeCDT(const std::vector<double>& inputVertices, 
                         const std::vector<uint32_t>& inputTriangles,
                         bool addBoundingBox = false,
                         bool verbose = false) {
    CDTResult result;
    
    try {
        // Initialize FPU
        initFPU();
        
        // Create input PLC from vectors
        inputPLC plc;
        std::vector<double> vertices = inputVertices;
        std::vector<uint32_t> triangles = inputTriangles;
        
        if (!plc.initFromVectors(vertices.data(), vertices.size() / 3, 
                                triangles.data(), triangles.size() / 3, verbose)) {
            cout << "Failed to initialize PLC from vectors" << endl;
            return result; // success remains false
        }
        
        if (addBoundingBox) {
            plc.addBoundingBoxVertices();
        }
        
        // Build Delaunay tetrahedrization
        TetMesh* tin = new TetMesh;
        tin->init_vertices(plc.coordinates.data(), plc.numVertices());
        tin->tetrahedrize();
        
        // Build structured PLC and recover constraints
        PLCx steinerPLC(*tin, plc.triangle_vertices.data(), plc.numTriangles());
        steinerPLC.segmentRecovery_HSi(!verbose);
        bool faceRecoverySuccess = steinerPLC.faceRecovery(!verbose);
        uint32_t numInnerTets = (uint32_t)steinerPLC.markInnerTets();
        
        // Extract results
        result.numInputVertices = plc.numVertices() - (addBoundingBox ? 8 : 0);
        result.numSteinerVertices = steinerPLC.numSteinerVertices();
        result.isPolyhedron = steinerPLC.is_polyhedron;
        result.success = faceRecoverySuccess;
        
        // Extract vertices (including Steiner points)
        result.vertices.reserve(tin->numVertices() * 3);
        for (uint32_t i = 0; i < tin->numVertices(); i++) {
            double x, y, z;
            tin->vertices[i]->getApproxXYZCoordinates(x, y, z);
            result.vertices.push_back(x);
            result.vertices.push_back(y);
            result.vertices.push_back(z);
        }
        
        // Extract tetrahedra (only non-ghost internal ones)
        result.tetrahedra.clear();
        uint32_t numTets = tin->numTets();
        for (uint64_t t = 0; t < numTets; t++) {
            if (!tin->isGhost(t) && tin->mark_tetrahedra[t] == DT_IN) {
                result.tetrahedra.push_back(tin->tet_node[t * 4]);
                result.tetrahedra.push_back(tin->tet_node[t * 4 + 1]);
                result.tetrahedra.push_back(tin->tet_node[t * 4 + 2]);
                result.tetrahedra.push_back(tin->tet_node[t * 4 + 3]);
            }
        }
        result.numTetrahedra = result.tetrahedra.size() / 4;
        
        delete tin;
        
    } catch (const std::exception& e) {
        cout << "Exception caught: " << e.what() << endl;
        result = CDTResult();
    }
    
    return result;
}

int main() {
    cout << "Testing CDT bindings logic..." << endl;
    
    // Create a simple test cube
    vector<double> vertices = {
        0, 0, 0,  // 0
        1, 0, 0,  // 1
        1, 1, 0,  // 2
        0, 1, 0,  // 3
        0, 0, 1,  // 4
        1, 0, 1,  // 5
        1, 1, 1,  // 6
        0, 1, 1   // 7
    };
    
    vector<uint32_t> triangles = {
        0, 1, 2,  2, 3, 0,  // bottom face
        4, 7, 6,  6, 5, 4,  // top face
        0, 4, 5,  5, 1, 0,  // front face
        2, 6, 7,  7, 3, 2,  // back face
        0, 3, 7,  7, 4, 0,  // left face
        1, 5, 6,  6, 2, 1   // right face
    };
    
    cout << "Input: " << vertices.size()/3 << " vertices, " << triangles.size()/3 << " triangles" << endl;
    
    CDTResult result = testComputeCDT(vertices, triangles, false, true);
    
    if (result.success) {
        cout << "✓ CDT computation succeeded!" << endl;
        cout << "  Input vertices: " << result.numInputVertices << endl;
        cout << "  Steiner vertices: " << result.numSteinerVertices << endl;
        cout << "  Total vertices: " << result.vertices.size()/3 << endl;
        cout << "  Tetrahedra: " << result.numTetrahedra << endl;
        cout << "  Is polyhedron: " << (result.isPolyhedron ? "yes" : "no") << endl;
    } else {
        cout << "✗ CDT computation failed" << endl;
        return 1;
    }
    
    return 0;
}