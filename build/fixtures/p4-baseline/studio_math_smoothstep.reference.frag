#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;







void main() {
    float float_1 = 0.2500;
    float float_2 = 0.7500;
    float float_3 = v_uv.x;
    float float_4 = smoothstep(float_1,float_2,float_3);
    fragColor = vec4(vec3(float_4), 1.0);
}
