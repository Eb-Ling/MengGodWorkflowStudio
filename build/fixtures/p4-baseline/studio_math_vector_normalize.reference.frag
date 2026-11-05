#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;







void main() {
    vec2 vec2_1 = normalize(v_uv);
    fragColor = vec4(vec2_1 * 0.5 + 0.5, 0.5, 1.0);
}
