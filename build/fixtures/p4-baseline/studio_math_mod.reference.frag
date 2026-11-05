#version 430
in vec2 v_uv;out vec4 fragColor;void main(){fragColor=vec4(vec3(mod(v_uv.x, 0.37)),1.0);}