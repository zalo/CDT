#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <vector>
#include <string>
#include <cmath>
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
            double x = 0.0, y = 0.0, z = 0.0; // Initialize to zero
            tin->vertices[i]->getApproxXYZCoordinates(x, y, z);
            
            // Verify coordinates are valid before adding
            if (std::isnan(x) || std::isinf(x) || 
                std::isnan(y) || std::isinf(y) || 
                std::isnan(z) || std::isinf(z)) {
                // Skip invalid vertices or fail the computation
                result = CDTResult(); // Reset to failed state
                delete tin;
                return result;
            }
            
            result.vertices.push_back(x);
            result.vertices.push_back(y);
            result.vertices.push_back(z);
        }
        
        // Extract tetrahedra (only non-ghost internal ones)
        result.tetrahedra.clear();
        uint32_t numTets = tin->numTets();
        for (uint64_t t = 0; t < numTets; t++) {
            if (!tin->isGhost(t) && tin->mark_tetrahedra[t] == DT_IN) {
                uint32_t v0 = tin->tet_node[t * 4];
                uint32_t v1 = tin->tet_node[t * 4 + 1];
                uint32_t v2 = tin->tet_node[t * 4 + 2];
                uint32_t v3 = tin->tet_node[t * 4 + 3];
                
                // Verify vertex indices are valid
                uint32_t maxVertexIndex = tin->numVertices();
                if (v0 >= maxVertexIndex || v1 >= maxVertexIndex || 
                    v2 >= maxVertexIndex || v3 >= maxVertexIndex ||
                    v0 == INFINITE_VERTEX || v1 == INFINITE_VERTEX ||
                    v2 == INFINITE_VERTEX || v3 == INFINITE_VERTEX) {
                    // Skip invalid tetrahedra
                    continue;
                }
                
                result.tetrahedra.push_back(v0);
                result.tetrahedra.push_back(v1);
                result.tetrahedra.push_back(v2);
                result.tetrahedra.push_back(v3);
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

// Simple test function to verify bindings work
int testFunction(int a, int b) {
    return a + b;
}

// Debug function to help troubleshoot issues
std::string debugInfo() {
    return "CDT WebAssembly Bindings v1.0 - Debug build";
}

// Helper functions to convert JavaScript arrays to std::vector
std::vector<double> valToDoubleVector(const emscripten::val& jsArray) {
    std::vector<double> result;
    const auto length = jsArray["length"].as<unsigned>();
    result.reserve(length);
    for (unsigned i = 0; i < length; ++i) {
        result.push_back(jsArray[i].as<double>());
    }
    return result;
}

std::vector<uint32_t> valToUint32Vector(const emscripten::val& jsArray) {
    std::vector<uint32_t> result;
    const auto length = jsArray["length"].as<unsigned>();
    result.reserve(length);
    for (unsigned i = 0; i < length; ++i) {
        result.push_back(jsArray[i].as<uint32_t>());
    }
    return result;
}

// JavaScript-friendly result structure
struct JSCDTResult {
    emscripten::val vertices;  // JavaScript array
    emscripten::val tetrahedra; // JavaScript array
    uint32_t numInputVertices;
    uint32_t numSteinerVertices;
    uint32_t numTetrahedra;
    bool isPolyhedron;
    bool success;
    
    JSCDTResult() : numInputVertices(0), numSteinerVertices(0), numTetrahedra(0), 
                    isPolyhedron(false), success(false) {
        vertices = emscripten::val::array();
        tetrahedra = emscripten::val::array();
    }
};

// Convert CDTResult to JSCDTResult with proper JavaScript arrays
JSCDTResult toJSResult(const CDTResult& result) {
    JSCDTResult jsResult;
    jsResult.numInputVertices = result.numInputVertices;
    jsResult.numSteinerVertices = result.numSteinerVertices;
    jsResult.numTetrahedra = result.numTetrahedra;
    jsResult.isPolyhedron = result.isPolyhedron;
    jsResult.success = result.success;
    
    // Convert vertices vector to JavaScript array
    jsResult.vertices = emscripten::val::array();
    for (size_t i = 0; i < result.vertices.size(); ++i) {
        double val = result.vertices[i];
        // Check for invalid values
        if (std::isnan(val) || std::isinf(val)) {
            // If we have invalid values, mark as failed and return empty arrays
            jsResult.success = false;
            jsResult.vertices = emscripten::val::array();
            jsResult.tetrahedra = emscripten::val::array();
            jsResult.numTetrahedra = 0;
            return jsResult;
        }
        jsResult.vertices.set(i, val);
    }
    
    // Convert tetrahedra vector to JavaScript array
    jsResult.tetrahedra = emscripten::val::array();
    for (size_t i = 0; i < result.tetrahedra.size(); ++i) {
        uint32_t val = result.tetrahedra[i];
        // Check for invalid vertex indices (should be less than total vertex count)
        if (val == INFINITE_VERTEX || (result.vertices.size() > 0 && val >= result.vertices.size() / 3)) {
            // If we have invalid indices, mark as failed and return empty arrays
            jsResult.success = false;
            jsResult.vertices = emscripten::val::array();
            jsResult.tetrahedra = emscripten::val::array();
            jsResult.numTetrahedra = 0;
            return jsResult;
        }
        jsResult.tetrahedra.set(i, val);
    }
    
    return jsResult;
}

// Wrapper functions to handle JavaScript arrays and default parameters
JSCDTResult computeCDT_wrapper(const emscripten::val& jsVertices, 
                              const emscripten::val& jsTriangles) {
    auto vertices = valToDoubleVector(jsVertices);
    auto triangles = valToUint32Vector(jsTriangles);
    auto result = computeCDT(vertices, triangles, false, false);
    return toJSResult(result);
}

JSCDTResult computeCDT_withOptions(const emscripten::val& jsVertices, 
                                  const emscripten::val& jsTriangles,
                                  bool addBoundingBox, bool verbose) {
    auto vertices = valToDoubleVector(jsVertices);
    auto triangles = valToUint32Vector(jsTriangles);
    auto result = computeCDT(vertices, triangles, addBoundingBox, verbose);
    return toJSResult(result);
}

// Wrapper for validateMesh to handle JavaScript arrays
MeshInfo validateMesh_wrapper(const emscripten::val& jsVertices, 
                             const emscripten::val& jsTriangles) {
    auto vertices = valToDoubleVector(jsVertices);
    auto triangles = valToUint32Vector(jsTriangles);
    return validateMesh(vertices, triangles);
}

EMSCRIPTEN_BINDINGS(cdt_module) {
    // Test function to verify bindings work
    emscripten::function("testFunction", &testFunction);
    emscripten::function("debugInfo", &debugInfo);
    
    // Register JSCDTResult structure with JavaScript-friendly arrays
    value_object<JSCDTResult>("CDTResult")
        .field("vertices", &JSCDTResult::vertices)
        .field("tetrahedra", &JSCDTResult::tetrahedra)
        .field("numInputVertices", &JSCDTResult::numInputVertices)
        .field("numSteinerVertices", &JSCDTResult::numSteinerVertices)
        .field("numTetrahedra", &JSCDTResult::numTetrahedra)
        .field("isPolyhedron", &JSCDTResult::isPolyhedron)
        .field("success", &JSCDTResult::success);
    
    // Register MeshInfo structure
    value_object<MeshInfo>("MeshInfo")
        .field("numVertices", &MeshInfo::numVertices)
        .field("numTriangles", &MeshInfo::numTriangles)
        .field("valid", &MeshInfo::valid);
    
    // Register functions - now accepting JavaScript arrays directly and returning JS-friendly results
    emscripten::function("computeCDT", &computeCDT_wrapper);
    emscripten::function("computeCDTWithOptions", &computeCDT_withOptions);
    emscripten::function("validateMesh", &validateMesh_wrapper);
}