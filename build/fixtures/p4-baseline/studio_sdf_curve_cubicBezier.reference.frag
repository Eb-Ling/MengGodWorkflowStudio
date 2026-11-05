#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;




vec2 cubic(vec2 p0,vec2 p1,vec2 p2,vec2 p3,float t){float u=1.-t;return u*u*u*p0+3.*u*u*t*p1+3.*u*t*t*p2+t*t*t*p3;}


void main() {
    vec2 vec2_1 = vec2(0.5000, 0.3000);
    vec2 vec2_2 = vec2(0.5000, 0.3000);
    vec2 vec2_3 = vec2(0.5000, 0.3000);
    float float_1 = v_uv.x;
    vec2 vec2_4 = cubic(v_uv,vec2_1,vec2_2,vec2_3,float_1);
    fragColor = vec4(vec2_4 * 0.5 + 0.5, 0.5, 1.0);
}
