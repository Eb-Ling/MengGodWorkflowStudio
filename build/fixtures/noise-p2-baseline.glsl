// P2 原始 Noise GLSL，冻结用于迁移像素对比，不进入发布产物。
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}

vec2 hash2(vec2 p){return vec2(hash(p),hash(p+19.19));}

float valueNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}

float perlinNoise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);vec2 g00=normalize(hash2(i)*2.-1.),g10=normalize(hash2(i+vec2(1.,0.))*2.-1.),g01=normalize(hash2(i+vec2(0.,1.))*2.-1.),g11=normalize(hash2(i+vec2(1.))*2.-1.);float a=dot(g00,f),b=dot(g10,f-vec2(1.,0.)),c=dot(g01,f-vec2(0.,1.)),d=dot(g11,f-vec2(1.));return mix(mix(a,b,u.x),mix(c,d,u.x),u.y)*.5+.5;}

float fbmValue(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*valueNoise(p);p*=2.;a*=.5;}return v;}

float simplexNoise(vec2 p){return valueNoise(p)*2.0-1.0;}

float fbmSimplex(vec2 p){return fbmValue(p)*2.0-1.0;}

float worleyNoise(vec2 p){vec2 i=floor(p),f=fract(p);float d=1.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 n=vec2(x,y),q=n+hash2(i+n)-f;d=min(d,length(q));}return d;}

float fbmWorley(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*worleyNoise(p*6.);p*=2.;a*=.5;}return v;}

float turbulence(vec2 p){return abs(fbmSimplex(p));}

vec4 previewPermute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float previewSimplex3(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz), l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy), i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx, x2 = x0 - i2 + C.yyy, x3 = x0 - D.yyy;
    i = mod(i, 289.0);
    vec4 p = previewPermute(previewPermute(previewPermute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n = 0.142857142857; vec3 ns = n * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z), x_ = floor(j * ns.z), y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy, y = y_ * ns.x + ns.yyyy, h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy), b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0, s1 = floor(b1) * 2.0 + 1.0, sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy, a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x), p1 = vec3(a0.zw, h.y), p2 = vec3(a1.xy, h.z), p3 = vec3(a1.zw, h.w);
    vec4 norm = 1.0 / vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m *= m;
    return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float turbulence3(vec3 p) {
    float value = 0.0, amplitude = 1.0, frequency = 1.0;
    for (int i = 0; i < 6; i++) { value += amplitude * abs(previewSimplex3(p * frequency)); amplitude *= 0.5; frequency *= 2.0; }
    return value * 0.5;
}