#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;




float lanceTaper(float t){t=clamp(t,0.,1.);return smoothstep(0.,.08,t)*(1.-smoothstep(.15,1.,t));}

float sdLance(vec2 p,float baseX,float tipX,float maxR){float t=clamp((p.x-baseX)/max(tipX-baseX,.0001),0.,1.);return abs(p.y)-maxR*lanceTaper(t);}


void main() {
    float float_1 = 0.1000;
    float float_2 = 0.9000;
    float float_3 = 0.3500;
    float float_4 = sdLance(v_uv,float_1,float_2,float_3);
    fragColor = vec4(vec3(float_4), 1.0);
}
