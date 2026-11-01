package data.workflowshader.runtime;

import com.fs.starfarer.api.combat.CombatEngineLayers;
import data.scripts.workflow.WorkflowBatch;
import data.workflowshader.compiler.FragmentCompiler;
import data.workflowshader.graph.Graph;
import java.util.LinkedHashMap;
import java.util.Map;
import org.boxutil.util.ShaderUtil;
import org.lwjgl.opengl.GL20;

/** Compatibility adapter for the Java graph prototype. GPU ownership lives only in WorkflowBatch. */
public final class WorkflowShaderPlugin extends WorkflowBatch {
    private final Graph graph;
    private final String output;
    private final Map<String,float[]> inputs=new LinkedHashMap<String,float[]>();
    public WorkflowShaderPlugin(Graph graph,String output,QuadVertices vertices,CombatEngineLayers layer){
        super(layer,"","",vertices.copy(),16,0,false);this.graph=graph;this.output=output;
    }
    public void setInput(String name,float... values){
        if(!name.matches("u_[A-Za-z0-9_]+")||name.equals("u_time")||name.equals("u_viewportAlpha")||name.equals("u_instanceOffset")||values.length<1||values.length>4)throw new IllegalArgumentException("Expected nonreserved float/vector input");
        for(float v:values)if(!Float.isFinite(v))throw new IllegalArgumentException("Nonfinite input");inputs.put(name,values.clone());
    }
    @Override protected int createProgram(){return ShaderUtil.createShaderVF(getClass().getName(),VERTEX,new FragmentCompiler().compile(graph,output).source());}
    @Override protected void bindSharedParameters(){for(Map.Entry<String,float[]> e:inputs.entrySet()){
        int location=uniform(e.getKey());float[] v=e.getValue();
        if(v.length==1)GL20.glUniform1f(location,v[0]);else if(v.length==2)GL20.glUniform2f(location,v[0],v[1]);else if(v.length==3)GL20.glUniform3f(location,v[0],v[1],v[2]);else GL20.glUniform4f(location,v[0],v[1],v[2],v[3]);
    }}
    private static final String VERTEX="""
        #version 430
        layout(location=0) in vec2 a_position;
        layout(std140) uniform BUtilGlobalData {mat4 gameViewport;vec4 gameScreenBorder;};
        struct Fixed2D {vec4 alpha_Facing_Location;vec2 scale;uvec2 colorBits;};
        layout(std430,binding=5) readonly buffer WorkflowTransforms {Fixed2D transforms[];};
        uniform int u_instanceOffset;
        out vec2 v_uv;
        void main(){
            v_uv=vec2((gl_VertexID&1)!=0?1:0,gl_VertexID>=2?1:0);
            Fixed2D instance=transforms[u_instanceOffset+gl_InstanceID];
            float a=radians(instance.alpha_Facing_Location.y),c=cos(a),s=sin(a);
            vec2 world=mat2(c,s,-s,c)*(a_position*instance.scale)+instance.alpha_Facing_Location.zw;
            gl_Position=gameViewport*vec4(world,0,1);
        }
        """;
}
