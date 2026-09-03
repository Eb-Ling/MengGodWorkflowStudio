package data.workflowshader.graph;

/** GLSL 4.20 types accepted by graph ports. */
public enum ValueType {
    FLOAT("float"), INT("int"), BOOL("bool"),
    VEC2("vec2"), VEC3("vec3"), VEC4("vec4"),
    MAT2("mat2"), MAT3("mat3"), MAT4("mat4"),
    SAMPLER2D("sampler2D"), SAMPLER_CUBE("samplerCube");
    private final String glsl;
    ValueType(String glsl) { this.glsl = glsl; }
    public String glsl() { return glsl; }
}
