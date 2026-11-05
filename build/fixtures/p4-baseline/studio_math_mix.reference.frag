#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;







void main() {
    float float_1 = v_uv.x;
    float float_2 = 0.3700;
    float float_3 = mix(float_1,float_2,float_1);
    fragColor = vec4(vec3(float_3), 1.0);
}
