#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;




float xFade(vec2 p,float baseX,float tipX){return smoothstep(baseX-8.,baseX+8.,p.x)*smoothstep(tipX+8.,tipX-8.,p.x);}


void main() {
    float float_1 = 0.1000;
    float float_2 = 0.9000;
    float float_3 = xFade(v_uv,float_1,float_2);
    fragColor = vec4(vec3(float_3), 1.0);
}
