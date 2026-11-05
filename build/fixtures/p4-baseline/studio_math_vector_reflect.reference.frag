#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;







void main() {
    vec2 vec2_1 = vec2(0.5000, 0.3000);
    vec2 vec2_2 = reflect(v_uv,vec2_1);
    fragColor = vec4(vec2_2 * 0.5 + 0.5, 0.5, 1.0);
}
