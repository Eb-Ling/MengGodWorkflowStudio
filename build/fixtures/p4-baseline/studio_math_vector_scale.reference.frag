#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;







void main() {
    float float_1 = 0.3700;
    vec2 vec2_1 = (v_uv * float_1);
    fragColor = vec4(vec2_1 * 0.5 + 0.5, 0.5, 1.0);
}
