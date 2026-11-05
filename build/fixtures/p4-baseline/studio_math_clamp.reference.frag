#version 430
in vec2 v_uv;out vec4 fragColor;void main(){fragColor=vec4(vec3(clamp(v_uv.x, 0.25, 0.75)),1.0);}