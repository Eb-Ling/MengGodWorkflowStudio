package data.method;

import com.fs.starfarer.api.Global;
import com.fs.starfarer.api.combat.*;
import com.fs.starfarer.api.graphics.SpriteAPI;
import java.nio.ByteBuffer;
import java.nio.FloatBuffer;
import java.util.*;
import org.boxutil.base.api.resource.TemporaryCleanupPlugin;
import org.boxutil.base.api.SimpleVAOAPI;
import org.boxutil.BoxUtilModPlugin;
import org.boxutil.config.BoxConfigs;
import org.boxutil.define.struct.instance.Fixed2DStruct;
import org.boxutil.manager.CombatRenderingManager;
import org.boxutil.manager.ShaderCore;
import org.boxutil.units.standard.ShaderProgram;
import org.boxutil.util.ShaderUtil;
import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.*;
import org.lwjgl.util.vector.Vector2f;

/** 一批实例共用材质与图层，在战斗线程更新，通过分层渲染接口绘制。 */
public abstract class WorkflowRuntime implements CombatLayeredRenderingPlugin {
    public static int apiVersion(){return 3;}
    protected static void requireApiVersion(int required){if(required!=apiVersion())throw new IllegalStateException("Workflow runtime API mismatch: required "+required+", found "+apiVersion()+"; re-export WorkflowRuntime.java and the effect together");}
    protected static void requireFinite(float value,String name){if(!Float.isFinite(value))throw new IllegalArgumentException(name+" must be finite");}
    protected static void requireLength(Object values,int count,String name){Objects.requireNonNull(values,name);if(java.lang.reflect.Array.getLength(values)!=count)throw new IllegalArgumentException(name+" length must equal positions.size() ("+count+")");}
    protected static void requirePosition(Vector2f position){
        Objects.requireNonNull(position,"position");requireFinite(position.x,"position.x");requireFinite(position.y,"position.y");
    }
    protected static void requirePositions(List<Vector2f> positions){
        Objects.requireNonNull(positions,"positions");
        for(Vector2f position:positions)requirePosition(position);
    }
    public static final class Instance {
        private WorkflowRuntime owner;
        private final Fixed2DStruct transform = new Fixed2DStruct();
        private ByteBuffer parameters;
        private boolean removed;
        private Instance(WorkflowRuntime owner) { this.owner=owner;parameters=BufferUtils.createByteBuffer(owner.stride);transform.setLocation(0,0).setFacing(0).setScale(1,1).setColor(1f,1f,1f,1f); }
        private void requireActive(){if(removed||owner==null||owner.expired)throw new IllegalStateException("Instance has been removed or its batch has expired");}
        /** 复制世界坐标，跟随舰船时每帧传入 ship.getLocation()，不持有调用方的向量。 */
        public Instance setPosition(Vector2f position){requireActive();requirePosition(position);transform.setLocation(position.x,position.y);owner.instancesDirty=true;return this;}
        public Instance setAngle(float degrees){requireActive();finite(degrees);transform.setFacing(degrees);owner.instancesDirty=true;return this;}
        public Instance setScale(float x,float y){requireActive();finite(x);finite(y);transform.setScale(x,y);owner.instancesDirty=true;return this;}
        public boolean isRemoved(){return removed;}
        public void remove(){if(removed)return;removed=true;owner.instancesDirty=true;parameters=null;owner=null;}
    }
    protected ShaderProgram program;
    protected float elapsed;
    private final CombatEngineLayers targetLayer;
    private final String vertexPath,fragmentPath;
    private final float[] vertices;
    private final int stride,textureCount;
    private final boolean additive;
    private final List<Instance> instances=new ArrayList<Instance>();
    private CombatEngineAPI engine;
    private CleanupRegistry cleanupRegistry;
    private final Map<String,Integer> uniformLocations=new HashMap<String,Integer>();
    private int transformBuffer;
    private FloatBuffer transformUpload;
    private final FloatBuffer projection=BufferUtils.createFloatBuffer(16), modelView=BufferUtils.createFloatBuffer(16), viewProjection=BufferUtils.createFloatBuffer(16);
    private ByteBuffer upload;
    private int capacity,parameterBuffer,vao,vbo;
    private SimpleVAOAPI sharedQuad;
    private boolean attempted,expired,released,cleanupRegistered;
    private boolean instancesDirty=true;

    protected WorkflowRuntime(CombatEngineLayers layer,String vertex,String fragment,float[] geometry,int stride,int textures,boolean additive){
        if(layer==null||geometry==null||geometry.length!=8||stride<16||stride%16!=0)throw new IllegalArgumentException("Invalid batch contract");
        for(float v:geometry)finite(v);
        targetLayer=layer;vertexPath=vertex;fragmentPath=fragment;vertices=geometry.clone();this.stride=stride;textureCount=textures;this.additive=additive;
    }
    private static void finite(float value){if(!Float.isFinite(value))throw new IllegalArgumentException("Expected finite value");}
    public final Instance createInstance(){if(expired)throw new IllegalStateException("Batch expired");Instance i=new Instance(this);instances.add(i);instancesDirty=true;return i;}
    public final void clearInstances(){for(Instance i:instances)i.remove();instances.clear();instancesDirty=true;}
    public final void markExpired(){expired=true;clearInstances();releaseInstanceReferences();}
    /** 生成的特效在这里释放构造时的实例引用，不进行 GL 操作。 */
    protected void releaseInstanceReferences(){}
    protected final void putFloat(Instance i,int offset,float value){check(i,offset);finite(value);i.parameters.putFloat(offset,value);instancesDirty=true;}
    protected final void putInt(Instance i,int offset,int value){check(i,offset);i.parameters.putInt(offset,value);instancesDirty=true;}
    private void check(Instance i,int offset){if(expired||i==null||i.owner!=this||i.removed||offset<0||offset+4>stride)throw new IllegalArgumentException("Invalid instance/parameter offset");}
    @Override public void init(CombatEntityAPI entity){engine=Global.getCombatEngine();}
    @Override public void advance(float amount){if(expired||engine==null)return;if(engine.isCombatOver()){markExpired();return;}if(!engine.isPaused())elapsed+=amount;}
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
    protected void registerCombatCleanup(){
        if(engine==null)throw new IllegalStateException("Register the plugin with the combat engine before rendering");
        String key=WorkflowRuntime.class.getName()+".cleanup";
        Object existing=engine.getCustomData().get(key);
        CleanupRegistry registry=existing instanceof CleanupRegistry?(CleanupRegistry)existing:new CleanupRegistry(engine,key);
        if(existing!=registry){CombatRenderingManager.addCleanupPlugin(registry);engine.getCustomData().put(key,registry);}
        registry.batches.add(this);cleanupRegistry=registry;
    }
    /** One callback per combat and runtime package; finished batches leave the registry. */
    private static final class CleanupRegistry implements TemporaryCleanupPlugin {
        private final CombatEngineAPI engine;
        private final String key;
        private final Set<WorkflowRuntime> batches=Collections.newSetFromMap(new IdentityHashMap<WorkflowRuntime,Boolean>());
        CleanupRegistry(CombatEngineAPI engine,String key){this.engine=engine;this.key=key;}
        @Override public void cleanupCombatOnce(){
            for(WorkflowRuntime batch:new ArrayList<WorkflowRuntime>(batches))batch.cleanup();
            batches.clear();if(engine.getCustomData().get(key)==this)engine.getCustomData().remove(key);
        }
    }
    private void initialize(){
        int id=createProgram();
        if(id<=0)throw new IllegalStateException("Shader loading/compilation/link failed; keep the exported paths under the Mod root: "+vertexPath+", "+fragmentPath);
        program=new ShaderProgram(id);
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
    /** 在实际分层绘制回调内读取 P × MV，使用当前战斗视口的平移与缩放。 */
    private void uploadViewProjection(){
        projection.clear();modelView.clear();viewProjection.clear();
        GL11.glGetFloat(GL11.GL_PROJECTION_MATRIX,projection);
        GL11.glGetFloat(GL11.GL_MODELVIEW_MATRIX,modelView);
        for(int column=0;column<4;column++)for(int row=0;row<4;row++){
            float value=0;
            for(int index=0;index<4;index++)value+=projection.get(index*4+row)*modelView.get(column*4+index);
            viewProjection.put(value);
        }
        viewProjection.flip();GL20.glUniformMatrix4(uniform("u_viewProjection"),false,viewProjection);
    }
    @Override public void render(CombatEngineLayers layer,ViewportAPI viewport){
        if(expired||layer!=targetLayer)return;
        instances.removeIf(i->i.removed);if(instances.isEmpty())return;
        if(!GLContext.getCapabilities().OpenGL43||!GLContext.getCapabilities().OpenGL11){Global.getLogger(getClass()).warn("Workflow requires OpenGL 4.3 compatibility support");cleanup();return;}
        // BoxUtil owns initialization. A plugin registered early waits without allocating resources.
        if(!BoxUtilModPlugin.isGlobalInitialized())return;
        if(!BoxConfigs.isShaderEnable()||!ShaderCore.isValid()){
            Global.getLogger(getClass()).warn("Workflow disabled: BoxUtil shaders/core are unavailable");cleanup();return;
        }
        try(WorkflowGlState ignored=new WorkflowGlState(textureCount)){
            if(!attempted){attempted=true;initialize();}
            program.active();uploadInstances();uploadViewProjection();
            GL11.glEnable(GL11.GL_BLEND);GL11.glDisable(GL11.GL_ALPHA_TEST);GL11.glDisable(GL11.GL_DEPTH_TEST);GL11.glDepthMask(false);GL11.glDisable(GL11.GL_CULL_FACE);
            GL20.glBlendEquationSeparate(GL14.GL_FUNC_ADD,GL14.GL_FUNC_ADD);
            GL14.glBlendFuncSeparate(GL11.GL_SRC_ALPHA,additive?GL11.GL_ONE:GL11.GL_ONE_MINUS_SRC_ALPHA,GL11.GL_ONE,GL11.GL_ONE_MINUS_SRC_ALPHA);
            GL20.glUniform1f(uniform("u_time"),elapsed);GL20.glUniform1f(uniform("u_viewportAlpha"),viewport.getAlphaMult());
            bindSharedParameters();GL30.glBindVertexArray(sharedQuad!=null?sharedQuad.getVAO():vao);
            GL31.glDrawArraysInstanced(GL11.GL_TRIANGLE_STRIP,0,4,instances.size());
        }catch(RuntimeException failure){Global.getLogger(getClass()).error("Workflow renderer disabled",failure);cleanup();}
    }
    @Override public void cleanup(){
        markExpired();if(released)return;released=true;
        if(transformBuffer!=0){GL15.glDeleteBuffers(transformBuffer);transformBuffer=0;}
        transformUpload=null;
        if(vao!=0){GL30.glDeleteVertexArrays(vao);vao=0;}if(vbo!=0){GL15.glDeleteBuffers(vbo);vbo=0;}
        if(parameterBuffer!=0){GL15.glDeleteBuffers(parameterBuffer);parameterBuffer=0;}
        if(program!=null){program.delete();program=null;}upload=null;uniformLocations.clear();sharedQuad=null;
        if(cleanupRegistry!=null){cleanupRegistry.batches.remove(this);cleanupRegistry=null;}engine=null;
    }
    private static final class WorkflowGlState implements AutoCloseable {
        private final int program = GL11.glGetInteger(GL20.GL_CURRENT_PROGRAM);
        private final int vao = GL11.glGetInteger(GL30.GL_VERTEX_ARRAY_BINDING);
        private final int array = GL11.glGetInteger(GL15.GL_ARRAY_BUFFER_BINDING);
        private final int ssbo = GL11.glGetInteger(GL43.GL_SHADER_STORAGE_BUFFER_BINDING);
        private final int activeTexture = GL11.glGetInteger(GL13.GL_ACTIVE_TEXTURE);
        private final int srcRgb = GL11.glGetInteger(GL14.GL_BLEND_SRC_RGB), dstRgb = GL11.glGetInteger(GL14.GL_BLEND_DST_RGB);
        private final int srcAlpha = GL11.glGetInteger(GL14.GL_BLEND_SRC_ALPHA), dstAlpha = GL11.glGetInteger(GL14.GL_BLEND_DST_ALPHA);
        private final int equationRgb = GL11.glGetInteger(GL20.GL_BLEND_EQUATION_RGB), equationAlpha = GL11.glGetInteger(GL20.GL_BLEND_EQUATION_ALPHA);
        private final boolean blend = GL11.glIsEnabled(GL11.GL_BLEND), alphaTest = GL11.glIsEnabled(GL11.GL_ALPHA_TEST), depth = GL11.glIsEnabled(GL11.GL_DEPTH_TEST), cull = GL11.glIsEnabled(GL11.GL_CULL_FACE);
        private final boolean depthMask = GL11.glGetBoolean(GL11.GL_DEPTH_WRITEMASK);
        private final int[] textures;
        private final int[] bindings = {0, 5}, buffers = new int[2];
        private final long[] starts = new long[2], sizes = new long[2];
    
        WorkflowGlState(int textureCount) {
            textures = new int[textureCount];
            for (int i=0;i<textureCount;i++) { GL13.glActiveTexture(GL13.GL_TEXTURE0+i); textures[i]=GL11.glGetInteger(GL11.GL_TEXTURE_BINDING_2D); }
            GL13.glActiveTexture(activeTexture);
            for (int i=0;i<bindings.length;i++) {
                buffers[i]=GL30.glGetInteger(GL43.GL_SHADER_STORAGE_BUFFER_BINDING,bindings[i]);
                starts[i]=GL32.glGetInteger64(GL43.GL_SHADER_STORAGE_BUFFER_START,bindings[i]);
                sizes[i]=GL32.glGetInteger64(GL43.GL_SHADER_STORAGE_BUFFER_SIZE,bindings[i]);
            }
        }
        private static void enable(int capability, boolean value) { if(value)GL11.glEnable(capability);else GL11.glDisable(capability); }
        @Override public void close() {
            for(int i=0;i<textures.length;i++){GL13.glActiveTexture(GL13.GL_TEXTURE0+i);GL11.glBindTexture(GL11.GL_TEXTURE_2D,textures[i]);}
            GL13.glActiveTexture(activeTexture);
            for(int i=0;i<bindings.length;i++) {
                if(buffers[i]!=0 && sizes[i]>0)GL30.glBindBufferRange(GL43.GL_SHADER_STORAGE_BUFFER,bindings[i],buffers[i],starts[i],sizes[i]);
                else GL30.glBindBufferBase(GL43.GL_SHADER_STORAGE_BUFFER,bindings[i],buffers[i]);
            }
            GL15.glBindBuffer(GL43.GL_SHADER_STORAGE_BUFFER,ssbo);
            GL30.glBindVertexArray(vao);GL15.glBindBuffer(GL15.GL_ARRAY_BUFFER,array);GL20.glUseProgram(program);
            enable(GL11.GL_BLEND,blend);enable(GL11.GL_ALPHA_TEST,alphaTest);enable(GL11.GL_DEPTH_TEST,depth);enable(GL11.GL_CULL_FACE,cull);GL11.glDepthMask(depthMask);
            GL14.glBlendFuncSeparate(srcRgb,dstRgb,srcAlpha,dstAlpha);GL20.glBlendEquationSeparate(equationRgb,equationAlpha);
        }
    }
    
}
