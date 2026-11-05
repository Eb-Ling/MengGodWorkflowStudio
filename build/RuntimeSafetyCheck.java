package data.scripts.workflow;

import com.fs.starfarer.api.Global;
import com.fs.starfarer.api.SettingsAPI;
import com.fs.starfarer.api.combat.*;
import com.fs.starfarer.api.graphics.SpriteAPI;
import data.method.WorkflowRuntime;
import data.scripts.UserRouteBatch;
import data.scripts.UserRouteTypes;
import java.lang.reflect.*;
import java.nio.*;
import java.nio.file.*;
import java.util.*;
import org.boxutil.base.api.resource.TemporaryCleanupPlugin;
import org.boxutil.config.BoxConfigGUI;
import org.boxutil.config.BoxConfigs;
import org.boxutil.manager.ShaderCore;
import org.boxutil.units.standard.ShaderProgram;
import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.*;
import org.lwjgl.util.vector.*;

/** Exercises unchanged UI downloads. Mocked game settings/state are confined to this JVM. */
public final class RuntimeSafetyCheck {
    private static final CombatEngineLayers LAYER=CombatEngineLayers.BELOW_SHIPS_LAYER;
    private static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
    private static Field declared(Class<?> type,String name)throws Exception{Field f=type.getDeclaredField(name);f.setAccessible(true);return f;}
    private static Object field(Object value,Class<?> type,String name)throws Exception{return declared(type,name).get(value);}
    private static void set(Class<?> type,String name,Object value)throws Exception{declared(type,name).set(null,value);}
    static final class BoxState implements AutoCloseable {
        private final Map<Field,Object> saved=new LinkedHashMap<>();
        BoxState(int ubo)throws Exception{
            for(var entry:Map.of(BoxConfigGUI.class,List.of("globalInit"),BoxConfigs.class,List.of("BUtil_EnableShader"),ShaderCore.class,List.of("glValid","glGlobalDataUBOValid","matrixUBO")).entrySet())
                for(String name:entry.getValue()){Field f=declared(entry.getKey(),name);saved.put(f,f.get(null));}
            ready(ubo);
        }
        void ready(int ubo)throws Exception{set(BoxConfigGUI.class,"globalInit",true);set(BoxConfigs.class,"BUtil_EnableShader",true);set(ShaderCore.class,"glValid",true);set(ShaderCore.class,"glGlobalDataUBOValid",true);set(ShaderCore.class,"matrixUBO",ubo);}
        @Override public void close()throws Exception{for(var entry:saved.entrySet())entry.getKey().set(null,entry.getValue());}
    }
    private static CombatEngineAPI engine(Map<String,Object> custom){return (CombatEngineAPI)Proxy.newProxyInstance(RuntimeSafetyCheck.class.getClassLoader(),new Class<?>[]{CombatEngineAPI.class},(o,m,a)->{
        if(m.getName().equals("getCustomData"))return custom;
        if(m.getName().equals("isPaused")||m.getName().equals("isCombatOver"))return false;
        throw new UnsupportedOperationException(m.getName());
    });}
    private static UserRouteBatch effect(){return new UserRouteBatch(LAYER,List.of(new Vector2f(-.5f,0),new Vector2f(.5f,0)),new Vector4f[]{new Vector4f(1,0,0,.25f),new Vector4f(0,1,0,1)},.001f);}
    private static void removedHandle(WorkflowRuntime.Instance instance)throws Exception{
        check(instance.isRemoved(),"Removed handle is marked");
        check(field(instance,WorkflowRuntime.Instance.class,"owner")==null&&field(instance,WorkflowRuntime.Instance.class,"parameters")==null,"Removed handle releases owner and parameter buffer");
        try{instance.setPosition(new Vector2f(1,2));throw new AssertionError("Removed handle accepted updates");}catch(IllegalStateException expected){}
        instance.remove();
    }
    private static int program(WorkflowRuntime effect)throws Exception{ShaderProgram p=(ShaderProgram)field(effect,WorkflowRuntime.class,"program");return p==null?0:p.getId();}
    private static void released(WorkflowRuntime effect,Class<?> generated,int oldProgram)throws Exception{
        check(effect.isExpired()&&program(effect)==0&&(oldProgram==0||!GL20.glIsProgram(oldProgram)),"Effect releases program");
        for(String name:new String[]{"parameterBuffer","transformBuffer","vao","vbo"})check((Integer)field(effect,WorkflowRuntime.class,name)==0,"Cleared GPU handle: "+name);
        for(Object handle:(Object[])field(effect,generated,"configuredInstances"))check(handle==null,"Generated effect releases original-row handles");
    }
    private static int red(){ByteBuffer pixel=BufferUtils.createByteBuffer(4);GL11.glReadPixels(64,128,1,1,GL11.GL_RGBA,GL11.GL_UNSIGNED_BYTE,pixel);return pixel.get(0)&255;}
    private static void clear(){GL11.glClearColor(0,0,0,0);GL11.glClear(GL11.GL_COLOR_BUFFER_BIT);}
    private static int matrix(){int id=GL15.glGenBuffers();GL15.glBindBuffer(GL31.GL_UNIFORM_BUFFER,id);FloatBuffer b=BufferUtils.createFloatBuffer(20);for(int n=0;n<20;n++)b.put(n<16&&n%5==0?1:0);b.flip();GL15.glBufferData(GL31.GL_UNIFORM_BUFFER,b,GL15.GL_STATIC_DRAW);return id;}
    private static Object registry(Map<String,Object> data){return data.get(WorkflowRuntime.class.getName()+".cleanup");}
    private static int registrySize(Object registry)throws Exception{return ((Set<?>)field(registry,registry.getClass(),"batches")).size();}

    public static void main(String[] args)throws Exception{
        Path evidence=Path.of(args[0]);Map<String,Object> custom=new HashMap<>();
        var previousEngine=Global.getCombatEngine();var previousSettings=Global.getSettings();
        Global.setCombatEngine(engine(custom));
        Global.setSettings((SettingsAPI)Proxy.newProxyInstance(RuntimeSafetyCheck.class.getClassLoader(),new Class<?>[]{SettingsAPI.class},(o,m,a)->{
            if(m.getName().equals("getScreenScaleMult"))return 1f;
            if(m.getName().equals("getBoolean"))return false;
            if(m.getName().equals("loadText")){
                String filename=Path.of((String)a[0]).getFileName().toString(),name=filename.substring(0,filename.lastIndexOf('.'));
                return Files.readString(evidence.resolve(name).resolve((String)a[0]));
            }
            throw new UnsupportedOperationException(m.getName());
        }));
        ViewportAPI viewport=(ViewportAPI)Proxy.newProxyInstance(RuntimeSafetyCheck.class.getClassLoader(),new Class<?>[]{ViewportAPI.class},(o,m,a)->m.getName().equals("getAlphaMult")?1f:null);
        for(Method method:WorkflowRuntime.class.getMethods())check(!Set.of("defaultInstance","setPosition","setAngle").contains(method.getName()),"No misleading batch/default-instance method: "+method.getName());
        UserRouteBatch cpu=effect();var removed=cpu.instance(0);removed.remove();removedHandle(removed);
        var retained=cpu.instance(1);cpu.markExpired();removedHandle(retained);
        for(Object handle:(Object[])field(cpu,UserRouteBatch.class,"configuredInstances"))check(handle==null,"markExpired immediately releases configured handles without GL");
        cpu.cleanup();cpu.cleanup();
        System.out.println("PASS: no hidden/default instance API; removed and expired handles reject updates and release CPU references without GL");

        Pbuffer context=new Pbuffer(256,256,new PixelFormat(),null,null,new ContextAttribs(4,3).withProfileCompatibility(true));
        try{
            context.makeCurrent();org.boxutil.define.GLWrapper.init();GL11.glViewport(0,0,256,256);
            int ubo=matrix(),alignment=GL11.glGetInteger(GL31.GL_UNIFORM_BUFFER_OFFSET_ALIGNMENT),external=GL15.glGenBuffers();
            GL15.glBindBuffer(GL31.GL_UNIFORM_BUFFER,external);GL15.glBufferData(GL31.GL_UNIFORM_BUFFER,BufferUtils.createByteBuffer(alignment+80),GL15.GL_STATIC_DRAW);
            GL30.glBindBufferRange(GL31.GL_UNIFORM_BUFFER,0,external,alignment,80);
            try(BoxState box=new BoxState(ubo)){
                UserRouteBatch transparent=effect();transparent.init(null);
                clear();GL11.glDisable(GL11.GL_ALPHA_TEST);transparent.render(LAYER,viewport);GL11.glFinish();int without=red();
                check(!GL11.glIsEnabled(GL11.GL_ALPHA_TEST),"Disabled Alpha Test remains disabled");
                clear();GL11.glEnable(GL11.GL_ALPHA_TEST);GL11.glAlphaFunc(GL11.GL_GREATER,.5f);transparent.render(LAYER,viewport);GL11.glFinish();int with=red();
                check(without>=60&&without<=66&&with==without,"Alpha 0.25 must render identically under inherited alpha threshold 0.5: "+without+" / "+with);
                check(GL11.glIsEnabled(GL11.GL_ALPHA_TEST)&&GL11.glGetInteger(GL11.GL_ALPHA_TEST_FUNC)==GL11.GL_GREATER&&GL11.glGetFloat(GL11.GL_ALPHA_TEST_REF)==.5f,"Alpha Test enable/function/reference preserved");
                check(GL30.glGetInteger(GL31.GL_UNIFORM_BUFFER_BINDING,0)==external&&GL32.glGetInteger64(GL31.GL_UNIFORM_BUFFER_START,0)==alignment&&GL32.glGetInteger64(GL31.GL_UNIFORM_BUFFER_SIZE,0)==80&&GL11.glGetInteger(GL31.GL_UNIFORM_BUFFER_BINDING)==external,"Viewport UBO binding/range restored");
                int owned=program(transparent);Object registry=registry(custom);check(registry!=null&&registrySize(registry)==1,"One live batch in combat registry");
                System.out.println("PASS: transparent pixel="+with+" with Alpha Test both off/on; external UBO binding and range untouched");

                SpriteAPI broken=(SpriteAPI)Proxy.newProxyInstance(RuntimeSafetyCheck.class.getClassLoader(),new Class<?>[]{SpriteAPI.class},(o,m,a)->{throw new IllegalStateException("intentional texture failure");});
                UserRouteTypes failed=new UserRouteTypes(LAYER,new Vector2f(),true,1,1,1f,new Vector2f(),new Vector3f(),new Vector4f(1,0,0,1),broken);
                failed.init(null);failed.render(LAYER,viewport);released(failed,UserRouteTypes.class,0);
                check(GL11.glIsEnabled(GL11.GL_ALPHA_TEST)&&GL11.glGetFloat(GL11.GL_ALPHA_TEST_REF)==.5f&&GL30.glGetInteger(GL31.GL_UNIFORM_BUFFER_BINDING,0)==external,"Failure path restores alpha test and viewport binding");
                check(registrySize(registry)==1,"Failed effect detaches from registry");
                System.out.println("PASS: rendering exception restores state and releases failed batch");

                transparent.instance(0).remove();transparent.instance(1).remove();transparent.render(LAYER,viewport);
                check(!transparent.isExpired()&&GL20.glIsProgram(owned),"Empty batch remains reusable");
                var extra=transparent.createInstance().setPosition(new Vector2f(-.5f,0));transparent.set_instanceTint(extra,new Vector4f(1,0,0,.25f));
                clear();transparent.render(LAYER,viewport);GL11.glFinish();check(red()==with,"Empty batch can be refilled with initialized parameters");
                transparent.markExpired();removedHandle(extra);transparent.cleanup();transparent.cleanup();released(transparent,UserRouteBatch.class,owned);
                check(registrySize(registry)==0,"Finished batch removed from shared registry");
                for(int n=0;n<8;n++){UserRouteBatch repeated=effect();repeated.init(null);repeated.render(LAYER,viewport);check(registry(custom)==registry&&registrySize(registry)==1,"Repeated effect reuses one registry");repeated.cleanup();check(registrySize(registry)==0,"Repeated effect leaves no retained batch");}
                UserRouteBatch end=effect();end.init(null);end.render(LAYER,viewport);int endProgram=program(end);((TemporaryCleanupPlugin)registry).cleanupCombatOnce();released(end,UserRouteBatch.class,endProgram);check(registry(custom)==null,"Combat cleanup removes its registry");
                Map<String,Object> nextCombat=new HashMap<>();Global.setCombatEngine(engine(nextCombat));UserRouteBatch next=effect();next.init(null);next.render(LAYER,viewport);check(registry(nextCombat)!=null&&registry(nextCombat)!=registry,"New combat uses a fresh registry");((TemporaryCleanupPlugin)registry(nextCombat)).cleanupCombatOnce();Global.setCombatEngine(engine(custom));
                System.out.println("PASS: empty batch reuse, repeated cleanup, repeated effects and next combat do not retain completed batches");

                UserRouteBatch waiting=effect();waiting.init(null);set(BoxConfigGUI.class,"globalInit",false);waiting.render(LAYER,viewport);check(!waiting.isExpired()&&program(waiting)==0,"Wait for BoxUtil initialization without GPU allocation");
                box.ready(ubo);waiting.render(LAYER,viewport);check(program(waiting)>0&&!waiting.isExpired(),"Draw once BoxUtil is ready");waiting.cleanup();
                for(int condition=0;condition<5;condition++){
                    box.ready(ubo);switch(condition){case 0->set(BoxConfigs.class,"BUtil_EnableShader",false);case 1->set(ShaderCore.class,"glValid",false);case 2->set(ShaderCore.class,"glGlobalDataUBOValid",false);case 3->set(ShaderCore.class,"matrixUBO",0);case 4->{int stale=matrix();GL15.glDeleteBuffers(stale);set(ShaderCore.class,"matrixUBO",stale);}}
                    UserRouteBatch unavailable=effect();unavailable.init(null);clear();unavailable.render(LAYER,viewport);GL11.glFinish();
                    if(condition<2)released(unavailable,UserRouteBatch.class,0);
                    else {check(!unavailable.isExpired()&&red()==with,"Drawing must not depend on a missing/stale BoxUtil global matrix UBO");unavailable.cleanup();}
                }
                box.ready(ubo);UserRouteBatch lost=effect();lost.init(null);lost.render(LAYER,viewport);int lostProgram=program(lost);set(BoxConfigs.class,"BUtil_EnableShader",false);lost.render(LAYER,viewport);released(lost,UserRouteBatch.class,lostProgram);box.ready(ubo);
                if(registry(custom)!=null)((TemporaryCleanupPlugin)registry(custom)).cleanupCombatOnce();
                check(GL15.glIsBuffer(ubo),"Shared matrix UBO is never deleted by effect");check(GL11.glGetError()==GL11.GL_NO_ERROR,"Safety regression leaves no GL error");
                System.out.println("PASS: waits for initialization; disabled/invalid core cleans up; missing/invalid/deleted global UBO does not affect drawing; external UBO survives");
            }finally{GL15.glDeleteBuffers(ubo);GL15.glDeleteBuffers(external);}
        }finally{context.destroy();Global.setCombatEngine(previousEngine);Global.setSettings(previousSettings);}
    }
}
