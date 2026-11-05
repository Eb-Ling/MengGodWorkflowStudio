#version 430
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;




mat2 rot2(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}


void main() {
    float float_1 = 0.3700;
    vec2 vec2_1 = rot2(float_1) * v_uv;
    fragColor = vec4(vec2_1 * 0.5 + 0.5, 0.5, 1.0);
}
