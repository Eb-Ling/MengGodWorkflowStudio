#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;







void main() {
    float float_1 = 0.3700;
    float float_2 = 0.3700;
    float float_3 = pow(float_1,float_2);
    fragColor = vec4(vec3(float_3), 1.0);
}
