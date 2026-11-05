#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;




float segDist(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(ba,ba),.0001,1e20);return length(pa-ba*clamp(dot(pa,ba)/h,0.,1.));}


void main() {
    vec2 vec2_1 = vec2(0.5000, 0.3000);
    float float_1 = segDist(v_uv,v_uv,vec2_1);
    fragColor = vec4(vec3(float_1), 1.0);
}
