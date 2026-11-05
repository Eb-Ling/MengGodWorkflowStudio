package data.scripts.workflow;

import data.method.WorkflowRuntime;

import com.fs.starfarer.api.combat.CombatEngineLayers;
import com.fs.starfarer.api.graphics.SpriteAPI;
import data.scripts.UserRouteBatch;
import data.scripts.UserRouteTypes;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.nio.*;
import java.nio.file.*;
import java.util.List;
import org.boxutil.define.struct.instance.Fixed2DStruct;
import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.*;
import org.lwjgl.util.vector.*;

/** Checks unmodified files downloaded through the packaged application's UI. */
public final class UserPathExportCheck {
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    private static Object field(Object object, Class<?> owner, String name) throws Exception {
        Field f = owner.getDeclaredField(name);
        f.setAccessible(true);
        return f.get(object);
    }
    private static ByteBuffer parameters(WorkflowRuntime.Instance instance) throws Exception {
        return (ByteBuffer) field(instance, WorkflowRuntime.Instance.class, "parameters");
    }
    private static float[] transform(WorkflowRuntime.Instance instance) throws Exception {
        return ((Fixed2DStruct) field(instance, WorkflowRuntime.Instance.class, "transform")).getData();
    }
    private static void rejects(Runnable action) {
        try { action.run(); throw new AssertionError("Expected invalid input to be rejected"); }
        catch (NullPointerException | IllegalArgumentException expected) { }
    }
    private static UserRouteBatch constructors() throws Exception {
        CombatEngineLayers layer = CombatEngineLayers.BELOW_SHIPS_LAYER;
        List<Vector2f> positions = positions();
        Vector4f[] colors = colors();
        UserRouteBatch effect = new UserRouteBatch(layer, positions, colors, .001f);
        List<?> instances = (List<?>) field(effect, WorkflowRuntime.class, "instances");
        check(instances.size() == 8, "Constructor must create exactly eight instances");
        for (int n = 0; n < 8; n++) {
            check(effect.instance(n) == instances.get(n), "Stable instance handle");
            float[] t = transform(effect.instance(n));
            check(t[2] == -.75f + (n % 4) * .5f && t[3] == (n < 4 ? -.5f : .5f), "Independent coordinates");
            check(t[1] == 0 && t[4] == 1 && t[5] == 1, "Transform defaults");
            ByteBuffer p = parameters(effect.instance(n));
            check(p.getFloat(n % 2 == 0 ? 0 : 4) == 1 && p.getFloat(12) == 1, "Color initialized and copied");
        }
        colors[0].set(0,0,0,0);positions.get(0).x=999;
        check(parameters(effect.instance(0)).getFloat(0) == 1 && transform(effect.instance(0))[2]==-.75f, "Plugin retains snapshots of vectors and coordinates");
        check((Float) field(effect, UserRouteBatch.class, "shared_stretch") == .001f, "Shared parameter initialized");
        check(field(effect, WorkflowRuntime.class, "program") == null, "Constructing requires no GL context");
        UserRouteBatch empty = new UserRouteBatch(layer, List.of(), new Vector4f[0], 1);
        check(((List<?>) field(empty, WorkflowRuntime.class, "instances")).isEmpty(), "No hidden default instance");
        rejects(() -> new UserRouteBatch(layer, null, colors(), 1));
        rejects(() -> new UserRouteBatch(layer, java.util.Collections.singletonList(null), new Vector4f[]{new Vector4f()}, 1));
        rejects(() -> new UserRouteBatch(layer, List.of(new Vector2f(Float.NaN,0)), new Vector4f[]{new Vector4f()}, 1));
        Vector2f center=new Vector2f(1234,-567);
        UserRouteBatch single=new UserRouteBatch(layer,center,new Vector4f(1,.5f,0,1),.001f);
        center.set(0,0);
        check(transform(single.instance(0))[2]==1234 && transform(single.instance(0))[3]==-567,"Single Vector2f constructor copies the center");
        check(parameters(single.instance(0)).getFloat(4)==.5f,"Single-value parameter delegates to the correct SSBO slot");
        single.instance(0).setPosition(new Vector2f(10,20));
        check(transform(single.instance(0))[2]==10 && transform(single.instance(0))[3]==20,"Vector2f updater copies world coordinates");
        rejects(()->single.instance(0).setPosition(null));
        rejects(()->single.instance(0).setPosition(new Vector2f(Float.POSITIVE_INFINITY,0)));
        rejects(()->new UserRouteBatch(layer,(Vector2f)null,new Vector4f(1,0,0,1),1));
        check(WorkflowRuntime.class.getSuperclass()==Object.class && com.fs.starfarer.api.combat.CombatLayeredRenderingPlugin.class.isAssignableFrom(WorkflowRuntime.class),"Runtime directly implements the game interface, with no Base superclass");
        rejects(() -> new UserRouteBatch(layer, positions(), colors(), Float.POSITIVE_INFINITY));
        rejects(() -> new UserRouteBatch(layer, positions(), new Vector4f[7], 1));
        rejects(() -> new UserRouteBatch(layer, positions(), new Vector4f[8], 1));
        rejects(() -> new UserRouteBatch(layer, positions(), null, 1));
        SpriteAPI sprite = (SpriteAPI) Proxy.newProxyInstance(UserPathExportCheck.class.getClassLoader(), new Class<?>[]{SpriteAPI.class}, (o,m,a) -> {
            throw new AssertionError("Texture should not be accessed while constructing");
        });
        UserRouteTypes typed = new UserRouteTypes(layer, new Vector2f(10,20), true,-9,-1,2.5f,
                new Vector2f(3,4), new Vector3f(5,6,7), new Vector4f(8,9,10,11),sprite);
        ByteBuffer p = parameters(typed.instance(0));
        check(p.getInt(0) == 1 && p.getInt(16) == -9 && p.getInt(32) == -1 && p.getFloat(48) == 2.5f
            && p.getFloat(68) == 4 && p.getFloat(88) == 7 && p.getFloat(108) == 11, "All seven types match SSBO slots");
        float[] t = transform(typed.instance(0));
        check(t[1] == 0 && t[2] == 10 && t[3] == 20 && t[4] == 1 && t[5] == 1, "Positions map to transforms once");
        check(field(typed, UserRouteTypes.class, "texture_sprite") == sprite, "Texture parameter passed through");
        data.scripts.Instance namedInstance = new data.scripts.Instance(layer, new Vector2f(12,34),new Vector4f(1,0,0,1),1);
        check(transform(namedInstance.instance(0))[2] == 12, "Plugin name Instance must not shadow its inherited handle type");
        var relocated = new data.scripts.RelocatedEffect(layer, positions(), colors(), .001f);
        check(relocated.getClass().getSuperclass() == data.method.changed.WorkflowRuntime.class, "Changed path must select the downloaded dependency package");
        check(((List<?>) field(relocated, data.method.changed.WorkflowRuntime.class, "instances")).size() == 8, "Relocated dependency creates all instances");
        check(WorkflowRuntime.apiVersion() == 3 && data.method.changed.WorkflowRuntime.apiVersion() == 3, "Both dependency exports implement the required API");
        System.out.println("PASS: UI-exported constructors initialize eight independent instances, shared/texture inputs and seven parameter types; invalid inputs rejected");
        return effect;
    }
    private static List<Vector2f> positions(){List<Vector2f> values=new java.util.ArrayList<>();for(int n=0;n<8;n++)values.add(new Vector2f(-.75f+(n%4)*.5f,n<4?-.5f:.5f));return values;}
    private static Vector4f[] colors(){Vector4f[] values=new Vector4f[8];for(int n=0;n<8;n++)values[n]=n%2==0?new Vector4f(1,0,0,1):new Vector4f(0,1,0,1);return values;}
    private static float[] repeated(float value){float[] values=new float[8];java.util.Arrays.fill(values,value);return values;}
    private static WorkflowRuntime geometry() throws Exception {
        float[] angles=repeated(0),widths=repeated(1);angles[0]=90;widths[1]=.5f;
        var effect=new data.scripts.ArrayVariationPlugin(CombatEngineLayers.BELOW_SHIPS_LAYER,positions(),
            repeated(0),repeated(0),widths,repeated(1),angles,
            repeated(-.15f),repeated(-.1f),repeated(.15f),repeated(-.1f),repeated(-.15f),repeated(.1f),repeated(.15f),repeated(.1f),colors(),repeated(0));
        check(parameters(effect.instance(0)).getFloat(4*16)==90,"Custom geometry ID writes the rotation slot");
        check(parameters(effect.instance(1)).getFloat(2*16)==.5f,"Independent scale array writes the scale slot");
        rejects(()->new data.scripts.ArrayVariationPlugin(CombatEngineLayers.BELOW_SHIPS_LAYER,positions(),
            repeated(0),repeated(0),new float[7],repeated(1),angles,
            repeated(-.15f),repeated(-.1f),repeated(.15f),repeated(-.1f),repeated(-.15f),repeated(.1f),repeated(.15f),repeated(.1f),colors(),repeated(0)));
        return effect;
    }
    private static void exampleInit() throws Exception {
        WorkflowRuntime[] registered={null};int[] calls={0};
        var engine=(com.fs.starfarer.api.combat.CombatEngineAPI)Proxy.newProxyInstance(UserPathExportCheck.class.getClassLoader(),new Class<?>[]{com.fs.starfarer.api.combat.CombatEngineAPI.class},(o,m,a)->{
            if(!m.getName().equals("addLayeredRenderingPlugin"))throw new AssertionError("Unexpected game call: "+m.getName());
            registered[0]=(WorkflowRuntime)a[0];calls[0]++;return null;
        });
        new data.scripts.UiInitExample().init(engine);
        check(calls[0]==1,"Example init must register only one rendering plugin");
        List<?> instances=(List<?>)field(registered[0],WorkflowRuntime.class,"instances");
        check(instances.size()==8,"Example init creates all eight coordinate rows");
        for(int n=0;n<8;n++){float[] t=transform((WorkflowRuntime.Instance)instances.get(n));check(t[2]==100+(n%4)*300&&t[3]==100+(n/4)*300,"Example coordinate order");}
        check((Float)field(registered[0],data.scripts.InstancedWavePlugin.class,"shared_amplitude")==20,"Example passes the shared amplitude directly");
        System.out.println("PASS: init copied from the visible workflow panel registers eight instances from the Vector2f list call");
    }
    private static int shader(int type, Path path) throws Exception {
        int id = GL20.glCreateShader(type);
        GL20.glShaderSource(id, Files.readString(path));
        GL20.glCompileShader(id);
        check(GL20.glGetShaderi(id, GL20.GL_COMPILE_STATUS) != 0, path + "\n" + GL20.glGetShaderInfoLog(id, 16384));
        return id;
    }
    private static int program(Path directory, String name) throws Exception {
        Path shaders;
        try (var files = Files.walk(directory.resolve("data"))) {
            List<Path> matches = files.filter(p -> p.getFileName().toString().equals(name + ".vert")).toList();
            check(matches.size() == 1, "Expected one exported vertex shader for " + name);
            shaders = matches.get(0).getParent();
        }
        int v = shader(GL20.GL_VERTEX_SHADER, shaders.resolve(name + ".vert"));
        int f = shader(GL20.GL_FRAGMENT_SHADER, shaders.resolve(name + ".frag"));
        int p = GL20.glCreateProgram();
        GL20.glAttachShader(p,v); GL20.glAttachShader(p,f); GL20.glLinkProgram(p);
        check(GL20.glGetProgrami(p, GL20.GL_LINK_STATUS) != 0, name + "\n" + GL20.glGetProgramInfoLog(p, 16384));
        GL20.glDeleteShader(v); GL20.glDeleteShader(f);
        System.out.println("LINK: " + name);
        return p;
    }
    private static int buffer(int target, ByteBuffer data) {
        int id = GL15.glGenBuffers(); GL15.glBindBuffer(target,id); GL15.glBufferData(target,data,GL15.GL_STATIC_DRAW); return id;
    }
    private static int floats(int target, float[] values) {
        ByteBuffer data = BufferUtils.createByteBuffer(values.length * 4);
        data.asFloatBuffer().put(values);
        return buffer(target,data);
    }
    private static void pixels(int program, String stretchUniform, WorkflowRuntime effect, boolean geometry) throws Exception {
        GL20.glUseProgram(program);
        FloatBuffer identity=BufferUtils.createFloatBuffer(16);for(int i=0;i<16;i++)identity.put(i%5==0?1:0);identity.flip();
        GL20.glUniformMatrix4(GL20.glGetUniformLocation(program,"u_viewProjection"),false,identity);
        int vao = GL30.glGenVertexArrays(); GL30.glBindVertexArray(vao);
        int vbo = floats(GL15.GL_ARRAY_BUFFER,(float[])field(effect,WorkflowRuntime.class,"vertices"));
        GL20.glEnableVertexAttribArray(0); GL20.glVertexAttribPointer(0,2,GL11.GL_FLOAT,false,8,0L);
        List<?> instances=(List<?>)field(effect,WorkflowRuntime.class,"instances");
        ByteBuffer transforms = BufferUtils.createByteBuffer(8 * 32), values = BufferUtils.createByteBuffer(8 * parameters((WorkflowRuntime.Instance)instances.get(0)).capacity());
        for (int n = 0; n < 8; n++) {
            for (float v : transform((WorkflowRuntime.Instance)instances.get(n))) transforms.putFloat(v);
            ByteBuffer p = parameters((WorkflowRuntime.Instance)instances.get(n)).duplicate(); p.clear(); values.put(p);
        }
        transforms.flip(); values.flip();
        int tb = buffer(GL43.GL_SHADER_STORAGE_BUFFER,transforms), pb = buffer(GL43.GL_SHADER_STORAGE_BUFFER,values);
        GL30.glBindBufferBase(GL43.GL_SHADER_STORAGE_BUFFER,5,tb); GL30.glBindBufferBase(GL43.GL_SHADER_STORAGE_BUFFER,0,pb);
        if(!geometry){int location = GL20.glGetUniformLocation(program,stretchUniform); check(location >= 0, "Connected vertex input must remain active");
        GL20.glUniform1f(location,(Float)field(effect,UserRouteBatch.class,"shared_stretch"));}
        GL20.glUniform1f(GL20.glGetUniformLocation(program,"u_viewportAlpha"),1);
        GL20.glUniform1i(GL20.glGetUniformLocation(program,"u_instanceOffset"),0);
        GL11.glViewport(0,0,256,256); GL11.glDisable(GL11.GL_BLEND); GL11.glDisable(GL11.GL_DEPTH_TEST); GL11.glDisable(GL11.GL_CULL_FACE);
        GL11.glClearColor(0,0,0,0); GL11.glClear(GL11.GL_COLOR_BUFFER_BIT);
        GL31.glDrawArraysInstanced(GL11.GL_TRIANGLE_STRIP,0,4,8); GL11.glFinish();
        ByteBuffer pixel = BufferUtils.createByteBuffer(4);
        for (int n = 0; n < 8; n++) {
            GL11.glReadPixels(32 + (n % 4) * 64,n < 4 ? 64 : 192,1,1,GL11.GL_RGBA,GL11.GL_UNSIGNED_BYTE,pixel);
            check((pixel.get(n % 2 == 0 ? 0 : 1) & 255) > 240 && (pixel.get(n % 2 == 0 ? 1 : 0) & 255) < 10, "Instance " + n + " must have its own position and color");
        }
        GL11.glReadPixels(64,64,1,1,GL11.GL_RGBA,GL11.GL_UNSIGNED_BYTE,pixel);
        check((pixel.get(0) & 255) < 10 && (pixel.get(1) & 255) < 10, "Space between instances must remain empty");
        if(geometry){
            GL11.glReadPixels(32+16,64,1,1,GL11.GL_RGBA,GL11.GL_UNSIGNED_BYTE,pixel);check((pixel.get(0)&255)<10,"90-degree rotation changes the first rectangle's width");
            GL11.glReadPixels(96+13,64,1,1,GL11.GL_RGBA,GL11.GL_UNSIGNED_BYTE,pixel);check((pixel.get(1)&255)<10,"Per-instance scale narrows the second rectangle");
            GL11.glReadPixels(160+16,64,1,1,GL11.GL_RGBA,GL11.GL_UNSIGNED_BYTE,pixel);check((pixel.get(0)&255)>240,"Vertex coordinate arrays set the third rectangle's width");
        }
        GL30.glBindVertexArray(0); GL30.glDeleteVertexArrays(vao);
        for (int id : new int[]{vbo,tb,pb}) GL15.glDeleteBuffers(id);
        System.out.println("PASS: actual downloaded shaders render all eight constructor-supplied positions/colors, with empty gaps");
    }
    private static void runtimeLifecycle(Path root, String stretchUniform) throws Exception {
        org.boxutil.define.GLWrapper.init();
        class Batch extends WorkflowRuntime {
            int registrations;
            Batch() { super(CombatEngineLayers.BELOW_SHIPS_LAYER,"","",new float[]{-.1f,-.1f,.1f,-.1f,-.1f,.1f,.1f,.1f},16,0,false); }
            @Override protected int createProgram() {
                try { return UserPathExportCheck.program(root.resolve("UserRouteBatch"),"UserRouteBatch"); }
                catch (Exception e) { throw new RuntimeException(e); }
            }
            @Override protected void registerCombatCleanup() { registrations++; }
            @Override protected void bindSharedParameters() { GL20.glUniform1f(uniform(stretchUniform),1); }
            void color(Instance i) { putFloat(i,0,1);putFloat(i,12,1); }
            int programId() { return program == null ? 0 : program.getId(); }
            float time() { return elapsed; }
        }
        boolean[] paused={false},over={false};
        var previous=com.fs.starfarer.api.Global.getCombatEngine();
        var previousSettings=com.fs.starfarer.api.Global.getSettings();
        com.fs.starfarer.api.Global.setSettings((com.fs.starfarer.api.SettingsAPI)Proxy.newProxyInstance(UserPathExportCheck.class.getClassLoader(),new Class<?>[]{com.fs.starfarer.api.SettingsAPI.class},(o,m,a)->{
            if(m.getName().equals("getScreenScaleMult"))return 1f;
            if(m.getName().equals("getBoolean"))return false;
            throw new UnsupportedOperationException(m.getName());
        }));
        var engine=(com.fs.starfarer.api.combat.CombatEngineAPI)Proxy.newProxyInstance(UserPathExportCheck.class.getClassLoader(),new Class<?>[]{com.fs.starfarer.api.combat.CombatEngineAPI.class},
            (o,m,a)->m.getName().equals("isPaused")?paused[0]:m.getName().equals("isCombatOver")?over[0]:null);
        var viewport=(com.fs.starfarer.api.combat.ViewportAPI)Proxy.newProxyInstance(UserPathExportCheck.class.getClassLoader(),new Class<?>[]{com.fs.starfarer.api.combat.ViewportAPI.class},(o,m,a)->m.getName().equals("getAlphaMult")?1f:null);
        com.fs.starfarer.api.Global.setCombatEngine(engine);
        float[] identity=new float[20];for(int n=0;n<16;n+=5)identity[n]=1;
        int ubo=floats(GL31.GL_UNIFORM_BUFFER,identity);GL30.glBindBufferBase(GL31.GL_UNIFORM_BUFFER,0,ubo);
        int externalVao=GL30.glGenVertexArrays();GL30.glBindVertexArray(externalVao);
        int externalVbo=floats(GL15.GL_ARRAY_BUFFER,new float[8]);
        int alignment=GL11.glGetInteger(GL43.GL_SHADER_STORAGE_BUFFER_OFFSET_ALIGNMENT);
        int externalSsbo=buffer(GL43.GL_SHADER_STORAGE_BUFFER,BufferUtils.createByteBuffer(alignment*2+256));
        for(int index:new int[]{0,5})GL30.glBindBufferRange(GL43.GL_SHADER_STORAGE_BUFFER,index,externalSsbo,alignment*(index==0?1L:2L),256);
        GL11.glEnable(GL11.GL_DEPTH_TEST);GL11.glDepthMask(true);
        var boxState=new RuntimeSafetyCheck.BoxState(ubo);
        Batch batch=new Batch();
        try {
            batch.init(null);check(batch.programId()==0,"Dependency init must defer GPU allocation");
            batch.advance(.5f);paused[0]=true;batch.advance(1);paused[0]=false;check(batch.time()==.5f,"Pause freezes dependency time");
            batch.clearInstances();for(int n=0;n<20;n++){var i=batch.createInstance().setPosition(new Vector2f((n%5-2)*.3f,(n/5-1.5f)*.3f));batch.color(i);}
            batch.render(CombatEngineLayers.BELOW_SHIPS_LAYER,viewport);int ownedProgram=batch.programId();
            check(!batch.isExpired()&&batch.registrations==1&&GL20.glIsProgram(ownedProgram),"Downloaded dependency initializes and draws");
            batch.render(CombatEngineLayers.BELOW_SHIPS_LAYER,viewport);check(batch.programId()==ownedProgram&&batch.registrations==1,"Static redraw reuses GPU resources");
            check(GL11.glGetInteger(GL20.GL_CURRENT_PROGRAM)==0&&GL11.glGetInteger(GL30.GL_VERTEX_ARRAY_BINDING)==externalVao&&GL11.glGetInteger(GL15.GL_ARRAY_BUFFER_BINDING)==externalVbo,"Nested guard restores program/VAO/VBO");
            check(GL11.glGetInteger(GL43.GL_SHADER_STORAGE_BUFFER_BINDING)==externalSsbo,"Nested guard restores generic SSBO binding");
            for(int index:new int[]{0,5})check(GL30.glGetInteger(GL43.GL_SHADER_STORAGE_BUFFER_BINDING,index)==externalSsbo&&GL32.glGetInteger64(GL43.GL_SHADER_STORAGE_BUFFER_START,index)==alignment*(index==0?1L:2L)&&GL32.glGetInteger64(GL43.GL_SHADER_STORAGE_BUFFER_SIZE,index)==256,"Nested guard restores SSBO ranges");
            check(GL11.glIsEnabled(GL11.GL_DEPTH_TEST)&&GL11.glGetBoolean(GL11.GL_DEPTH_WRITEMASK),"Nested guard restores depth state");
            batch.clearInstances();var i=batch.createInstance();batch.color(i);batch.render(CombatEngineLayers.BELOW_SHIPS_LAYER,viewport);i.remove();batch.render(CombatEngineLayers.BELOW_SHIPS_LAYER,viewport);
            over[0]=true;batch.advance(0);check(batch.isExpired(),"Battle completion expires dependency");
            batch.cleanup();batch.cleanup();check(!GL20.glIsProgram(ownedProgram)&&GL15.glIsBuffer(ubo),"Cleanup releases owned resources and keeps external UBO");
            check(GL11.glGetError()==GL11.GL_NO_ERROR,"Downloaded dependency lifecycle GL error");
            System.out.println("PASS: downloaded single-source runtime renders 20 instances, restores GL state, reuses buffers, removes instances, pauses and cleans up twice");
        } finally {
            batch.cleanup();boxState.close();com.fs.starfarer.api.Global.setCombatEngine(previous);com.fs.starfarer.api.Global.setSettings(previousSettings);GL30.glBindVertexArray(0);GL30.glDeleteVertexArrays(externalVao);
            for(int id:new int[]{ubo,externalVbo,externalSsbo})GL15.glDeleteBuffers(id);
        }
    }
    public static void main(String[] args) throws Exception {
        UserRouteBatch effect = constructors();WorkflowRuntime varied=geometry();exampleInit();
        Pbuffer context = new Pbuffer(256,256,new PixelFormat(),null,null,new ContextAttribs(4,3).withProfileCompatibility(true));
        try {
            context.makeCurrent(); System.out.println("OpenGL: " + GL11.glGetString(GL11.GL_VERSION));
            for (String name : new String[]{"UserRouteBatch","UserRouteTypes","InstancedWavePlugin","ArrayVariationPlugin","Instance","RelocatedEffect"}) {
                int p = program(Path.of(args[0]).resolve(name),name);
                if (name.equals("UserRouteBatch")) pixels(p,args[1],effect,false);
                if (name.equals("ArrayVariationPlugin")) pixels(p,"",varied,true);
                GL20.glUseProgram(0); GL20.glDeleteProgram(p);
            }
            runtimeLifecycle(Path.of(args[0]),args[1]);
            if (args.length > 2) {
                int pluginProgram = program(Path.of(args[2]), "PluginApiEffect");
                GL20.glDeleteProgram(pluginProgram);
                System.out.println("PASS: actual UI export using the independently registered typed-IR node compiles and links");
            }
            check(GL11.glGetError() == GL11.GL_NO_ERROR, "OpenGL error during export verification");
            System.out.println("PASS: all six unmodified UI exports, both dependency packages and the visible init example compile; geometry arrays and shaders work on the driver");
        } finally { context.destroy(); }
    }
}
