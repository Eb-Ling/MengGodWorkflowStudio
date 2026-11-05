#version 430
in vec2 v_uv;out vec4 fragColor;void main(){fragColor=vec4(vec3(0.2 + ((v_uv.x - 0.1) / (0.9 - 0.1)) * (0.8 - 0.2)),1.0);}