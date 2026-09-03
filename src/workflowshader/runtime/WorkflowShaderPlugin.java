package data.workflowshader.runtime;

import com.fs.starfarer.api.Global;
import com.fs.starfarer.api.combat.*;
import data.methods.Kratogen_BoxBasedUtils;
import data.workflowshader.compiler.FragmentCompiler;
import data.workflowshader.graph.Graph;
import org.boxutil.manager.ShaderCore;
import org.boxutil.units.standard.ShaderProgram;
import org.boxutil.util.ShaderUtil;
import org.lwjgl.opengl.*;
import org.lwjgl.util.vector.Vector2f;
import java.nio.FloatBuffer;
import org.lwjgl.BufferUtils;
import java.util.*;

/** BoxUtil-backed modern renderer for a workflow graph. Uses VAO/VBO, UBO projection and modelMatrix only. */
public final class WorkflowShaderPlugin extends CombatRenderPlugin {
    private final Graph graph;private final String outputNode;private final QuadVertices vertices;private final Vector2f position=new Vector2f();
    private final Map<String,float[]> inputs=new HashMap<String,float[]>();private ShaderProgram program;private int vao,vbo;private FloatBuffer modelMatrix;private float elapsed,angle;private boolean expired;
    /**
     * The explicit four local vertices are mandatory. This prevents hidden rectangle geometry and
     * makes the generated plugin suitable for beams, arbitrary quads and future mesh extensions.
     */
    public WorkflowShaderPlugin(Graph graph,String outputNode,QuadVertices vertices,CombatEngineLayers layer){super(layer);if(vertices==null)throw new IllegalArgumentException("Plugin vertices are required");this.graph=graph;this.outputNode=outputNode;this.vertices=vertices;}
    public void setPosition(float x,float y){position.set(x,y);} public void setAngle(float degrees){angle=degrees;}
    /** Sets scalar/vector custom uniform values. Input names must be graph InputNode u_* names. */
    public void setInput(String name,float... values){if(!name.startsWith("u_")||values.length<1||values.length>4)throw new IllegalArgumentException("Expected u_* uniform with 1..4 values");inputs.put(name,values.clone());}
    @Override public void advance(float amount){if(!Global.getCombatEngine().isPaused())elapsed+=amount;} @Override public float getRenderRadius(){return vertices.maxRadius();}
    @Override public void init(CombatEntityAPI entity){super.init(entity);initializeGpu();}
    @Override public void render(CombatEngineLayers current,ViewportAPI viewport){if(expired||program==null)return;modelMatrix=Kratogen_BoxBasedUtils.maintainAnchoredFloatBuffer(position,angle,modelMatrix);try(GlStateGuard ignored=GlStateGuard.capture()){GL11.glEnable(GL11.GL_BLEND);GL14.glBlendFuncSeparate(GL11.GL_SRC_ALPHA,GL11.GL_ONE,GL11.GL_ONE,GL11.GL_ONE);GL30.glBindVertexArray(vao);program.active();GL20.glUniformMatrix4(program.location[0],false,modelMatrix);GL20.glUniform1f(program.location[1],elapsed);for(Map.Entry<String,float[]> entry:inputs.entrySet())setUniform(entry.getKey(),entry.getValue());GL11.glDrawArrays(GL11.GL_TRIANGLE_STRIP,0,4);program.close();}}
    @Override public void cleanup(){expired=true;if(vao!=0)GL30.glDeleteVertexArrays(vao);if(vbo!=0)GL15.glDeleteBuffers(vbo);if(program!=null)program.delete();vao=vbo=0;program=null;}
    @Override public boolean isExpired(){return expired;}
    private void initializeGpu(){try{FragmentCompiler.Result result=new FragmentCompiler().compile(graph,outputNode);int id=ShaderUtil.createShaderVF(getClass().getName(),VERTEX,result.source());if(id<=0)throw new IllegalStateException("Shader compilation/linking failed");program=new ShaderProgram(id);program.location=new int[]{program.getUniformIndex("modelMatrix"),program.getUniformIndex("u_time")};program.uboLocation=new int[]{program.getUBOIndex("BUtilGlobalData",ShaderCore.getMatrixUBOBinding())};createQuadVao();}catch(Exception ex){Global.getLogger(WorkflowShaderPlugin.class).error("Workflow shader disabled",ex);expired=true;}}
    private void setUniform(String name,float[] value){int location=program.getUniformIndex(name);if(location<0)return;if(value.length==1)GL20.glUniform1f(location,value[0]);else if(value.length==2)GL20.glUniform2f(location,value[0],value[1]);else if(value.length==3)GL20.glUniform3f(location,value[0],value[1],value[2]);else GL20.glUniform4f(location,value[0],value[1],value[2],value[3]);}
    /** Explicit position+UV VBO. No hidden unit rectangle or fixed-function vertex generation. */
    private void createQuadVao(){float[] xy=vertices.copy();FloatBuffer data=BufferUtils.createFloatBuffer(16);for(int i=0;i<4;i++){data.put(xy[i*2]).put(xy[i*2+1]).put((i&1)==0?0f:1f).put(i<2?0f:1f);}data.flip();vao=GL30.glGenVertexArrays();GL30.glBindVertexArray(vao);vbo=GL15.glGenBuffers();GL15.glBindBuffer(GL15.GL_ARRAY_BUFFER,vbo);GL15.glBufferData(GL15.GL_ARRAY_BUFFER,data,GL15.GL_STATIC_DRAW);GL20.glVertexAttribPointer(0,2,GL11.GL_FLOAT,false,16,0);GL20.glEnableVertexAttribArray(0);GL20.glVertexAttribPointer(1,2,GL11.GL_FLOAT,false,16,8);GL20.glEnableVertexAttribArray(1);GL15.glBindBuffer(GL15.GL_ARRAY_BUFFER,0);GL30.glBindVertexArray(0);}
    private static final String VERTEX="#version 420\nlayout(location=0) in vec2 a_position;layout(location=1) in vec2 a_uv;\nlayout(std140,binding=0) uniform BUtilGlobalData{mat4 gameViewport;vec4 gameScreenBorder;};\nuniform mat4 modelMatrix;out vec2 v_uv;\nvoid main(){v_uv=a_uv;gl_Position=gameViewport*vec4((modelMatrix*vec4(a_position,0.0,1.0)).xy,0.0,1.0);}\n";
}
