#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;




float lanceTaper(float t){t=clamp(t,0.,1.);return smoothstep(0.,.08,t)*(1.-smoothstep(.15,1.,t));}


void main() {
    float float_1 = v_uv.x;
    float float_2 = lanceTaper(float_1);
    fragColor = vec4(vec3(float_2), 1.0);
}
