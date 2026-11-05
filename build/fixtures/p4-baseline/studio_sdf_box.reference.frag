#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;




float sdBox(vec2 p,vec2 b){vec2 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,q.y),0.);}


void main() {
    vec2 vec2_1 = vec2(0.5000, 0.3000);
    float float_1 = sdBox(v_uv,vec2_1);
    fragColor = vec4(vec3(float_1), 1.0);
}
