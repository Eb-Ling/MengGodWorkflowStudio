#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;







void main() {
    float float_1 = 0.5000;
    float float_2 = (length(v_uv) - float_1);
    fragColor = vec4(vec3(float_2), 1.0);
}
