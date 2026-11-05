#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;







void main() {
    float float_1 = v_uv.x;
    fragColor = vec4(vec3(float_1), 1.0);
}
