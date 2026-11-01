package data.scripts.workflow;

import com.fs.starfarer.api.Global;
import com.fs.starfarer.api.combat.*;
import com.fs.starfarer.api.graphics.SpriteAPI;
import java.nio.ByteBuffer;
import java.nio.FloatBuffer;
import java.util.*;
import org.boxutil.base.api.resource.TemporaryCleanupPlugin;
import org.boxutil.base.api.SimpleVAOAPI;
import org.boxutil.define.struct.instance.Fixed2DStruct;
import org.boxutil.manager.CombatRenderingManager;
import org.boxutil.manager.ShaderCore;
import org.boxutil.units.standard.ShaderProgram;
import org.boxutil.util.ShaderUtil;
import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.*;

/** One material and layer per batch. CPU mutation is restricted to the combat/render thread. */
public abstract class WorkflowBatch extends BaseCombatLayeredRenderingPlugin {
    public static final class Instance {
        private final WorkflowBatch owner;
        private final Fixed2DStruct transform = new Fixed2DStruct();
        private final ByteBuffer parameters;
        private boolean removed;
        private Instance(WorkflowBatch owner) { this.owner=owner;parameters=BufferUtils.createByteBuffer(owner.stride);transform.setLocation(0,0).setFacing(0).setScale(1,1).setColor(1f,1f,1f,1f); }
        public Instance setPosition(float x,float y){finite(x);finite(y);transform.setLocation(x,y);owner.instancesDirty=true;return this;}
        public Instance setAngle(float degrees){finite(degrees);transform.setFacing(degrees);owner.instancesDirty=true;return this;}
        public Instance setScale(float x,float y){finite(x);finite(y);transform.setScale(x,y);owner.instancesDirty=true;return this;}
        public void remove(){removed=true;owner.instancesDirty=true;}
    }
    protected ShaderProgram program;
    protected float elapsed;
    private final CombatEngineLayers targetLayer;
    private final String vertexPath,fragmentPath;
    private final float[] vertices;
    private final int stride,textureCount;
    private final boolean additive;
    private final List<Instance> instances=new ArrayList<Instance>();
    private final Instance primary;
    private CombatEngineAPI engine;
    private final Map<String,Integer> uniformLocations=new HashMap<String,Integer>();
    private int transformBuffer;
    private FloatBuffer transformUpload;
    private ByteBuffer upload;
    private int capacity,parameterBuffer,vao,vbo;
    private SimpleVAOAPI sharedQuad;
    private boolean attempted,expired,released,cleanupRegistered;
    private boolean instancesDirty=true;

    protected WorkflowBatch(CombatEngineLayers layer,String vertex,String fragment,float[] geometry,int stride,int textures,boolean additive){
        if(layer==null||geometry==null||geometry.length!=8||stride<16||stride%16!=0)throw new IllegalArgumentException("Invalid batch contract");
        for(float v:geometry)finite(v);
        targetLayer=layer;vertexPath=vertex;fragmentPath=fragment;vertices=geometry.clone();this.stride=stride;textureCount=textures;this.additive=additive;
        primary=createInstance();
    }
    private static void finite(float value){if(!Float.isFinite(value))throw new IllegalArgumentException("Expected finite value");}
    public final Instance createInstance(){if(expired)throw new IllegalStateException("Batch expired");Instance i=new Instance(this);instances.add(i);instancesDirty=true;return i;}
    public final Instance defaultInstance(){return primary;}
    public final void clearInstances(){for(Instance i:instances)i.removed=true;instances.clear();instancesDirty=true;}
    public final void setPosition(float x,float y){primary.setPosition(x,y);}
    public final void setAngle(float angle){primary.setAngle(angle);}
    public final void markExpired(){expired=true;}
    protected final void putFloat(Instance i,int offset,float value){check(i,offset);finite(value);i.parameters.putFloat(offset,value);instancesDirty=true;}
    protected final void putInt(Instance i,int offset,int value){check(i,offset);i.parameters.putInt(offset,value);instancesDirty=true;}
    private void check(Instance i,int offset){if(i==null||i.owner!=this||i.removed||offset<0||offset+4>stride)throw new IllegalArgumentException("Invalid instance/parameter offset");}
    @Override public void init(CombatEntityAPI entity){super.init(entity);engine=Global.getCombatEngine();}
    @Override public void advance(float amount){if(engine==null)return;if(engine.isCombatOver()){expired=true;return;}if(!engine.isPaused())elapsed+=amount;}
    @Override public boolean isExpired(){return expired;}
    @Override public EnumSet<CombatEngineLayers> getActiveLayers(){return EnumSet.of(targetLayer);}
    // Arbitrary vertex graphs can move vertices outside CPU-known bounds. Do not incorrectly cull them.
    @Override public float getRenderRadius(){return Float.MAX_VALUE;}
    protected abstract void bindSharedParameters();
    protected final void bindTexture(String name,int unit,SpriteAPI sprite){
        if(sprite==null)throw new IllegalArgumentException("Missing texture: "+name);
        GL13.glActiveTexture(GL13.GL_TEXTURE0+unit);GL11.glBindTexture(GL11.GL_TEXTURE_2D,sprite.getTextureId());
        GL20.glUniform1i(uniform(name),unit);
        GL20.glUniform2f(uniform("u_textureAspect_"+name),sprite.getWidth(),sprite.getHeight());
    }
    protected int createProgram(){return ShaderUtil.createShaderVFFormPath(getClass().getName(),vertexPath,fragmentPath);}
    protected final int uniform(String name){return uniformLocations.computeIfAbsent(name,key->GL20.glGetUniformLocation(program.getId(),key));}
    protected void registerCombatCleanup(){CombatRenderingManager.addCleanupPlugin(new TemporaryCleanupPlugin(){@Override public void cleanupCombatOnce(){cleanup();}});}
    private void initialize(){
        int id=createProgram();
        if(id<=0)throw new IllegalStateException("Shader compilation/link failed: "+vertexPath);
        program=new ShaderProgram(id);
        program.initUniformBlockSize(1).loadAndSetUniformBlockIndex("BUtilGlobalData",ShaderCore.getMatrixUBOBinding());
        if(GL11.glGetInteger(GL43.GL_MAX_VERTEX_SHADER_STORAGE_BLOCKS)<2 || textureCount>GL11.glGetInteger(GL20.GL_MAX_TEXTURE_IMAGE_UNITS))throw new IllegalStateException("Insufficient shader storage or texture units");
        parameterBuffer=GL15.glGenBuffers();transformBuffer=GL15.glGenBuffers();
        if(parameterBuffer==0||transformBuffer==0)throw new IllegalStateException("SSBO allocation failed");
        // Borrow only the exact canonical quad; never edit or destroy BoxUtil's shared VAO.
        if(Arrays.equals(vertices,new float[]{-1,-1,1,-1,-1,1,1,1}))sharedQuad=ShaderCore.getDefaultQuadObject();
        if(sharedQuad==null||!sharedQuad.isValid()){
            sharedQuad=null;vao=GL30.glGenVertexArrays();vbo=GL15.glGenBuffers();
            if(vao==0||vbo==0||parameterBuffer==0)throw new IllegalStateException("GPU allocation failed");
            GL30.glBindVertexArray(vao);GL15.glBindBuffer(GL15.GL_ARRAY_BUFFER,vbo);
            FloatBuffer data=BufferUtils.createFloatBuffer(8);data.put(vertices).flip();GL15.glBufferData(GL15.GL_ARRAY_BUFFER,data,GL15.GL_STATIC_DRAW);
            GL20.glEnableVertexAttribArray(0);GL20.glVertexAttribPointer(0,2,GL11.GL_FLOAT,false,8,0L);
        }
        if(!cleanupRegistered){registerCombatCleanup();cleanupRegistered=true;}
    }
    private void uploadInstances(){
        int count=instances.size();
        if(instancesDirty){
        if(count>capacity){
            int next=Math.max(count,Math.max(16,capacity*2));
            long maxBlock=GL32.glGetInteger64(GL43.GL_MAX_SHADER_STORAGE_BLOCK_SIZE);
            if((long)next*Math.max(stride,32)>maxBlock)throw new IllegalStateException("Instance data exceeds device SSBO block limit");
            capacity=next;upload=BufferUtils.createByteBuffer(Math.multiplyExact(capacity,stride));
            transformUpload=BufferUtils.createFloatBuffer(Math.multiplyExact(capacity,8));
        }
        transformUpload.clear();for(Instance i:instances)transformUpload.put(i.transform.getData());transformUpload.flip();
        GL15.glBindBuffer(GL43.GL_SHADER_STORAGE_BUFFER,transformBuffer);
        GL15.glBufferData(GL43.GL_SHADER_STORAGE_BUFFER,(long)capacity*32,GL15.GL_STREAM_DRAW);
        GL15.glBufferSubData(GL43.GL_SHADER_STORAGE_BUFFER,0L,transformUpload);
        upload.clear();for(Instance i:instances){i.parameters.position(0);upload.put(i.parameters);i.parameters.position(0);}upload.flip();
        GL15.glBindBuffer(GL43.GL_SHADER_STORAGE_BUFFER,parameterBuffer);
        GL15.glBufferData(GL43.GL_SHADER_STORAGE_BUFFER,(long)capacity*stride,GL15.GL_STREAM_DRAW);
        GL15.glBufferSubData(GL43.GL_SHADER_STORAGE_BUFFER,0L,upload);
        instancesDirty=false;
        }
        GL30.glBindBufferBase(GL43.GL_SHADER_STORAGE_BUFFER,0,parameterBuffer);
        GL30.glBindBufferBase(GL43.GL_SHADER_STORAGE_BUFFER,5,transformBuffer);
        GL20.glUniform1i(uniform("u_instanceOffset"),0);
    }
    @Override public void render(CombatEngineLayers layer,ViewportAPI viewport){
        if(expired||layer!=targetLayer)return;
        if(!GLContext.getCapabilities().OpenGL43){expired=true;Global.getLogger(getClass()).warn("Workflow requires OpenGL 4.3");return;}
        instances.removeIf(i->i.removed);if(instances.isEmpty())return;
        try(WorkflowGlState ignored=new WorkflowGlState(textureCount)){
            if(!attempted){attempted=true;initialize();}
            program.active();uploadInstances();
            GL11.glEnable(GL11.GL_BLEND);GL11.glDisable(GL11.GL_DEPTH_TEST);GL11.glDepthMask(false);GL11.glDisable(GL11.GL_CULL_FACE);
            GL20.glBlendEquationSeparate(GL14.GL_FUNC_ADD,GL14.GL_FUNC_ADD);
            GL14.glBlendFuncSeparate(GL11.GL_SRC_ALPHA,additive?GL11.GL_ONE:GL11.GL_ONE_MINUS_SRC_ALPHA,GL11.GL_ONE,GL11.GL_ONE_MINUS_SRC_ALPHA);
            GL20.glUniform1f(uniform("u_time"),elapsed);GL20.glUniform1f(uniform("u_viewportAlpha"),viewport.getAlphaMult());
            bindSharedParameters();GL30.glBindVertexArray(sharedQuad!=null?sharedQuad.getVAO():vao);
            GL31.glDrawArraysInstanced(GL11.GL_TRIANGLE_STRIP,0,4,instances.size());
        }catch(RuntimeException failure){Global.getLogger(getClass()).error("Workflow renderer disabled",failure);cleanup();}
    }
    @Override public void cleanup(){
        expired=true;if(released)return;released=true;
        if(transformBuffer!=0){GL15.glDeleteBuffers(transformBuffer);transformBuffer=0;}
        transformUpload=null;
        if(vao!=0){GL30.glDeleteVertexArrays(vao);vao=0;}if(vbo!=0){GL15.glDeleteBuffers(vbo);vbo=0;}
        if(parameterBuffer!=0){GL15.glDeleteBuffers(parameterBuffer);parameterBuffer=0;}
        if(program!=null){program.delete();program=null;}upload=null;uniformLocations.clear();instances.clear();
    }
}
