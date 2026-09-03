package data.workflowshader.nodes;

import data.workflowshader.graph.*;
import java.util.*;

/** Built-in UE-style nodes: graph inputs, scalar/vector math and procedural noise. */
public final class Nodes {
    private Nodes() { }
    /** Every user input is type-specialized from its editor type variable before compilation. */
    public static Node input(String id, String uniform, ValueType type) { return new InputNode(id, uniform, type); }
    /** Fragment-stage UV provided by the runtime vertex shader: `out vec2 v_uv` -> `in vec2 v_uv`. */
    public static Node uv(String id) { return fixed(id,"Texture Coordinate","uv",ValueType.VEC2,"v_uv"); }
    public static Node time(String id) { return fixed(id,"Time","value",ValueType.FLOAT,"u_time"); }
    public static Node constant(String id,ValueType type,String expression) { return fixed(id,"Constant","value",type,expression); }
    public static Node add(String id,ValueType type) { return binary(id,"Add",type,"+"); }
    public static Node subtract(String id,ValueType type) { return binary(id,"Subtract",type,"-"); }
    public static Node multiply(String id,ValueType type) { return binary(id,"Multiply",type,"*"); }
    public static Node sine(String id) { return unary(id,"Sine",ValueType.FLOAT,"sin($x)"); }
    public static Node cosine(String id) { return unary(id,"Cosine",ValueType.FLOAT,"cos($x)"); }
    public static Node absolute(String id, ValueType type) { return unary(id,"Absolute",type,"abs($x)"); }
    public static Node floor(String id, ValueType type) { return unary(id,"Floor",type,"floor($x)"); }
    public static Node clamp(String id, ValueType type) { return composite(id,"Clamp",type,"clamp($value,$min,$max)",new Socket("value",type,zero(type)),new Socket("min",type,zero(type)),new Socket("max",type,type==ValueType.FLOAT?"1.0":type.glsl()+"(1.0)")); }
    public static Node mix(String id, ValueType type) { return composite(id,"Lerp",type,"mix($a,$b,$t)",new Socket("a",type,zero(type)),new Socket("b",type,zero(type)),new Socket("t",ValueType.FLOAT,"0.5")); }
    public static Node length(String id) { return unary(id,"Length",ValueType.VEC2,"length($x)"); }
    public static Node normalize(String id, ValueType type) { return unary(id,"Normalize",type,"normalize($x)"); }
    public static Node dot(String id, ValueType type) { return composite(id,"Dot",ValueType.FLOAT,"dot($a,$b)",new Socket("a",type,zero(type)),new Socket("b",type,zero(type))); }
    public static Node textureSample(String id) { return composite(id,"Texture Sample",ValueType.VEC4,"texture($texture,$uv)",new Socket("texture",ValueType.SAMPLER2D,"u_texture"),new Socket("uv",ValueType.VEC2,"v_uv")); }
    public static Node fract(String id,ValueType type) { return unary(id,"Fraction",type,"fract($x)"); }
    public static Node combine2(String id) { return composite(id,"Combine Vec2",ValueType.VEC2,"vec2($x,$y)",new Socket("x",ValueType.FLOAT,"0.0"),new Socket("y",ValueType.FLOAT,"0.0")); }
    public static Node combine3(String id) { return composite(id,"Combine Vec3",ValueType.VEC3,"vec3($x,$y,$z)",new Socket("x",ValueType.FLOAT,"0.0"),new Socket("y",ValueType.FLOAT,"0.0"),new Socket("z",ValueType.FLOAT,"0.0")); }
    public static Node combine4(String id) { return composite(id,"Combine RGBA",ValueType.VEC4,"vec4($rgb,$a)",new Socket("rgb",ValueType.VEC3,"vec3(1.0)"),new Socket("a",ValueType.FLOAT,"1.0")); }
    public static Node valueNoise(String id) { return noise(id,"Value Noise","wf_valueNoise($uv)",NOISE_VALUE,new Socket("uv",ValueType.VEC2,"v_uv")); }
    public static Node fbm(String id) { return noise(id,"Fractal Noise","wf_fbm($uv,$octaves)",NOISE_FBM,new Socket("uv",ValueType.VEC2,"v_uv"),new Socket("octaves",ValueType.FLOAT,"4.0")); }
    private static Node fixed(final String id,final String title,final String port,final ValueType type,final String expr) { return new Node(id,title){{output(port,type);}@Override public Map<String,String> emit(NodeEmitContext c){return Collections.singletonMap(port,expr);}}; }
    private static Node unary(final String id,final String title,final ValueType type,final String expr) { return composite(id,title,type,expr,new Socket("x",type,zero(type))); }
    private static Node binary(final String id,final String title,final ValueType type,final String op) { return composite(id,title,type,"$a "+op+" $b",new Socket("a",type,zero(type)),new Socket("b",type,zero(type))); }
    private static Node composite(final String id,final String title,final ValueType outType,final String expr,final Socket... sockets) {
        return new Node(id,title){{for(Socket socket:sockets)input(socket.name(),socket.type(),socket.defaultExpression());output("value",outType);}@Override public Map<String,String> emit(NodeEmitContext c){String value=expr;for(Socket socket:sockets)value=value.replace("$"+socket.name(),c.input(socket.name()));return Collections.singletonMap("value",value);}};
    }
    private static Node noise(final String id,final String title,final String expr,final String function,final Socket... sockets) {
        return new Node(id,title){{for(Socket socket:sockets)input(socket.name(),socket.type(),socket.defaultExpression());output("value",ValueType.FLOAT);}@Override public Map<String,String> emit(NodeEmitContext c){String value=expr;for(Socket socket:sockets)value=value.replace("$"+socket.name(),c.input(socket.name()));return Collections.singletonMap("value",value);}@Override public String functions(){return function;}};
    }
    private static String zero(ValueType type) { return type==ValueType.FLOAT?"0.0":type.glsl()+"(0.0)"; }
    private static final String NOISE_VALUE =
            "float wf_hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}\n"+
            "float wf_valueNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(wf_hash(i),wf_hash(i+vec2(1.,0.)),f.x),mix(wf_hash(i+vec2(0.,1.)),wf_hash(i+vec2(1.,1.)),f.x),f.y);}\n";
    private static final String NOISE_FBM = NOISE_VALUE+
            "float wf_fbm(vec2 p,float octaves){float v=0.,a=.5;for(int i=0;i<8;i++){if(float(i)>=octaves)break;v+=a*wf_valueNoise(p);p=p*2.03+17.1;a*=.5;}return v;}\n";
}
