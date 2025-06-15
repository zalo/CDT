#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <vector>
#include <string>
#include "delaunay.h"
#include "inputPLC.h"
#include "PLC.h"
#include "numerics.h"

using namespace emscripten;

// Simplified CDT result structure
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

// Main CDT computation function
CDTResult computeCDT(const std::vector<double>& inputVertices, 
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
        // Return failed result
        result = CDTResult();
    }
    
    return result;
}

// Simplified function that just returns vertex and triangle counts for validation
struct MeshInfo {
    uint32_t numVertices;
    uint32_t numTriangles;
    bool valid;
    
    MeshInfo() : numVertices(0), numTriangles(0), valid(false) {}
};

MeshInfo validateMesh(const std::vector<double>& vertices, 
                      const std::vector<uint32_t>& triangles) {
    MeshInfo info;
    
    if (vertices.size() % 3 != 0 || triangles.size() % 3 != 0) {
        return info; // invalid
    }
    
    info.numVertices = vertices.size() / 3;
    info.numTriangles = triangles.size() / 3;
    info.valid = (info.numVertices > 0 && info.numTriangles > 0);
    
    return info;
}

EMSCRIPTEN_BINDINGS(cdt_module) {
    // Register vector types
    register_vector<double>("VectorDouble");
    register_vector<uint32_t>("VectorUint32");
    
    // Register CDTResult structure
    value_object<CDTResult>("CDTResult")
        .field("vertices", &CDTResult::vertices)
        .field("tetrahedra", &CDTResult::tetrahedra)
        .field("numInputVertices", &CDTResult::numInputVertices)
        .field("numSteinerVertices", &CDTResult::numSteinerVertices)
        .field("numTetrahedra", &CDTResult::numTetrahedra)
        .field("isPolyhedron", &CDTResult::isPolyhedron)
        .field("success", &CDTResult::success);
    
    // Register MeshInfo structure
    value_object<MeshInfo>("MeshInfo")
        .field("numVertices", &MeshInfo::numVertices)
        .field("numTriangles", &MeshInfo::numTriangles)
        .field("valid", &MeshInfo::valid);
    
    // Register main functions
    emscripten::function("computeCDT", &computeCDT);
    emscripten::function("validateMesh", &validateMesh);
}