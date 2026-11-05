#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;







void main() {
    float float_1 = length(v_uv);
    fragColor = vec4(vec3(float_1), 1.0);
}
