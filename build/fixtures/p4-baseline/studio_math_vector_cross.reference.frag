#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;







void main() {
    vec3 vec3_1 = vec3(0.2000, 0.5000, 0.7000);
    vec3 vec3_2 = vec3(0.2000, 0.5000, 0.7000);
    vec3 vec3_3 = cross(vec3_1,vec3_2);
    fragColor = vec4(vec3_3, 1.0);
}
