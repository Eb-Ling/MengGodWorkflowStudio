#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;




float bezier4(vec2 p0,vec2 p1,vec2 p2,vec2 p3,vec2 p4,float t){float u=1.-t;return (u*u*u*u*p0+4.*u*u*u*t*p1+6.*u*u*t*t*p2+4.*u*t*t*t*p3+t*t*t*t*p4).y;}


void main() {
    vec2 vec2_1 = vec2(0.5000, 0.3000);
    vec2 vec2_2 = vec2(0.5000, 0.3000);
    vec2 vec2_3 = vec2(0.5000, 0.3000);
    vec2 vec2_4 = vec2(0.5000, 0.3000);
    float float_1 = v_uv.x;
    float float_2 = bezier4(v_uv,vec2_1,vec2_2,vec2_3,vec2_4,float_1);
    fragColor = vec4(vec3(float_2), 1.0);
}
