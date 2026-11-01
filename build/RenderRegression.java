package data.scripts.workflow;

import java.nio.*;
import java.nio.file.*;
import java.util.*;
import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.*;

/** Offscreen driver checks: real shader linking, instancing pixels and state isolation. */
public final class RenderRegression {
    private static void check(boolean condition,String message){if(!condition)throw new AssertionError(message);}
    private static int shader(int type,String source){int s=GL20.glCreateShader(type);GL20.glShaderSource(s,source);GL20.glCompileShader(s);check(GL20.glGetShaderi(s,GL20.GL_COMPILE_STATUS)!=0,GL20.glGetShaderInfoLog(s,16384));return s;}
    private static int program(Path vertex,Path fragment)throws Exception{int v=shader(GL20.GL_VERTEX_SHADER,Files.readString(vertex)),f=shader(GL20.GL_FRAGMENT_SHADER,Files.readString(fragment)),p=GL20.glCreateProgram();GL20.glAttachShader(p,v);GL20.glAttachShader(p,f);GL20.glLinkProgram(p);String log=GL20.glGetProgramInfoLog(p,16384);GL20.glDeleteShader(v);GL20.glDeleteShader(f);check(GL20.glGetProgrami(p,GL20.GL_LINK_STATUS)!=0,vertex+"\n"+log);return p;}
    private static int buffer(int target,int bytes){int b=GL15.glGenBuffers();GL15.glBindBuffer(target,b);GL15.glBufferData(target,bytes,GL15.GL_DYNAMIC_DRAW);return b;}
    private static void pixels(int program){
        GL20.glUseProgram(program);int block=GL31.glGetUniformBlockIndex(program,"BUtilGlobalData");GL31.glUniformBlockBinding(program,block,0);
        int ubo=buffer(GL31.GL_UNIFORM_BUFFER,80);FloatBuffer matrix=BufferUtils.createFloatBuffer(20);for(int i=0;i<20;i++)matrix.put(i<16&&i%5==0?1f:0f);matrix.flip();GL15.glBufferSubData(GL31.GL_UNIFORM_BUFFER,0,matrix);GL30.glBindBufferBase(GL31.GL_UNIFORM_BUFFER,0,ubo);
        int vao=GL30.glGenVertexArrays();GL30.glBindVertexArray(vao);int vbo=buffer(GL15.GL_ARRAY_BUFFER,32);FloatBuffer quad=BufferUtils.createFloatBuffer(8);quad.put(new float[]{-.2f,-.2f,.2f,-.2f,-.2f,.2f,.2f,.2f}).flip();GL15.glBufferSubData(GL15.GL_ARRAY_BUFFER,0,quad);GL20.glEnableVertexAttribArray(0);GL20.glVertexAttribPointer(0,2,GL11.GL_FLOAT,false,8,0L);
        int transforms=buffer(GL43.GL_SHADER_STORAGE_BUFFER,64);FloatBuffer t=BufferUtils.createFloatBuffer(16);t.put(new float[]{1,0,-.45f,0,1,1,0,0, 1,0,.45f,0,1,1,0,0}).flip();GL15.glBufferSubData(GL43.GL_SHADER_STORAGE_BUFFER,0,t);GL30.glBindBufferBase(GL43.GL_SHADER_STORAGE_BUFFER,5,transforms);
        int params=buffer(GL43.GL_SHADER_STORAGE_BUFFER,64);FloatBuffer data=BufferUtils.createFloatBuffer(16);data.put(new float[]{1,0,0,1,1,0,0,0, 0,1,0,1,1,0,0,0}).flip();GL15.glBufferSubData(GL43.GL_SHADER_STORAGE_BUFFER,0,data);GL30.glBindBufferBase(GL43.GL_SHADER_STORAGE_BUFFER,0,params);
        GL20.glUniform1f(GL20.glGetUniformLocation(program,"u_time"),0);GL20.glUniform1f(GL20.glGetUniformLocation(program,"u_viewportAlpha"),1);GL20.glUniform1i(GL20.glGetUniformLocation(program,"u_instanceOffset"),0);
        GL11.glViewport(0,0,128,128);GL11.glDisable(GL11.GL_BLEND);GL11.glDisable(GL11.GL_DEPTH_TEST);GL11.glDisable(GL11.GL_CULL_FACE);GL11.glClearColor(0,0,0,0);GL11.glClear(GL11.GL_COLOR_BUFFER_BIT);
        GL31.glDrawArraysInstanced(GL11.GL_TRIANGLE_STRIP,0,4,2);GL11.glFinish();
        ByteBuffer pixel=BufferUtils.createByteBuffer(4);GL11.glReadPixels(35,64,1,1,GL11.GL_RGBA,GL11.GL_UNSIGNED_BYTE,pixel);check((pixel.get(0)&255)>240&&(pixel.get(1)&255)<10,"Left instance must be red");
        GL11.glReadPixels(93,64,1,1,GL11.GL_RGBA,GL11.GL_UNSIGNED_BYTE,pixel);check((pixel.get(1)&255)>240&&(pixel.get(0)&255)<10,"Right instance must be green");
        GL11.glReadPixels(64,64,1,1,GL11.GL_RGBA,GL11.GL_UNSIGNED_BYTE,pixel);check((pixel.get(0)&255)<10&&(pixel.get(1)&255)<10,"Instances must not fill gap");
        GL30.glBindVertexArray(0);GL30.glDeleteVertexArrays(vao);for(int b:new int[]{ubo,vbo,transforms,params})GL15.glDeleteBuffers(b);System.out.println("PASS: two independent SSBO instances rendered red/green at expected positions");
    }
    private static void state(int program){
        GL20.glUseProgram(program);int vao=GL30.glGenVertexArrays();GL30.glBindVertexArray(vao);int array=buffer(GL15.GL_ARRAY_BUFFER,32),storage=buffer(GL43.GL_SHADER_STORAGE_BUFFER,8192),alignment=GL11.glGetInteger(GL43.GL_SHADER_STORAGE_BUFFER_OFFSET_ALIGNMENT);
        GL30.glBindBufferRange(GL43.GL_SHADER_STORAGE_BUFFER,0,storage,alignment,256);GL30.glBindBufferRange(GL43.GL_SHADER_STORAGE_BUFFER,5,storage,alignment*2L,256);
        GL11.glEnable(GL11.GL_BLEND);GL11.glEnable(GL11.GL_DEPTH_TEST);GL11.glEnable(GL11.GL_CULL_FACE);GL11.glDepthMask(true);GL14.glBlendFuncSeparate(GL11.GL_ONE,GL11.GL_ZERO,GL11.GL_ZERO,GL11.GL_ONE);GL20.glBlendEquationSeparate(GL14.GL_FUNC_SUBTRACT,GL14.GL_FUNC_REVERSE_SUBTRACT);
        int texture=GL11.glGenTextures();GL13.glActiveTexture(GL13.GL_TEXTURE0);GL11.glBindTexture(GL11.GL_TEXTURE_2D,texture);GL13.glActiveTexture(GL13.GL_TEXTURE3);
        try{try(WorkflowGlState ignored=new WorkflowGlState(1)){GL20.glUseProgram(0);GL30.glBindVertexArray(0);GL15.glBindBuffer(GL15.GL_ARRAY_BUFFER,0);GL30.glBindBufferBase(GL43.GL_SHADER_STORAGE_BUFFER,0,0);GL30.glBindBufferBase(GL43.GL_SHADER_STORAGE_BUFFER,5,0);GL11.glDisable(GL11.GL_BLEND);GL11.glDisable(GL11.GL_DEPTH_TEST);GL11.glDisable(GL11.GL_CULL_FACE);GL11.glDepthMask(false);GL13.glActiveTexture(GL13.GL_TEXTURE0);GL11.glBindTexture(GL11.GL_TEXTURE_2D,0);throw new IllegalStateException("intentional");}}catch(IllegalStateException expected){}
        check(GL11.glGetInteger(GL20.GL_CURRENT_PROGRAM)==program,"program restore");check(GL11.glGetInteger(GL30.GL_VERTEX_ARRAY_BINDING)==vao,"VAO restore");check(GL11.glGetInteger(GL15.GL_ARRAY_BUFFER_BINDING)==array,"VBO restore");check(GL11.glGetInteger(GL43.GL_SHADER_STORAGE_BUFFER_BINDING)==storage,"SSBO restore");
        for(int index:new int[]{0,5}){check(GL30.glGetInteger(GL43.GL_SHADER_STORAGE_BUFFER_BINDING,index)==storage,"Indexed SSBO restore");check(GL32.glGetInteger64(GL43.GL_SHADER_STORAGE_BUFFER_START,index)==alignment*(index==0?1L:2L),"Range offset restore");check(GL32.glGetInteger64(GL43.GL_SHADER_STORAGE_BUFFER_SIZE,index)==256,"Range length restore");}
        check(GL11.glGetInteger(GL13.GL_ACTIVE_TEXTURE)==GL13.GL_TEXTURE3,"Active texture restore");GL13.glActiveTexture(GL13.GL_TEXTURE0);check(GL11.glGetInteger(GL11.GL_TEXTURE_BINDING_2D)==texture,"Texture restore");
        check(GL11.glIsEnabled(GL11.GL_BLEND)&&GL11.glIsEnabled(GL11.GL_DEPTH_TEST)&&GL11.glIsEnabled(GL11.GL_CULL_FACE)&&GL11.glGetBoolean(GL11.GL_DEPTH_WRITEMASK),"enable/depth state restore");check(GL11.glGetInteger(GL20.GL_BLEND_EQUATION_RGB)==GL14.GL_FUNC_SUBTRACT,"Blend equation restore");
        GL11.glDeleteTextures(texture);GL30.glBindVertexArray(0);GL30.glDeleteVertexArrays(vao);GL15.glDeleteBuffers(array);GL15.glDeleteBuffers(storage);System.out.println("PASS: exception path restores program, VAO/VBO, SSBO ranges, textures, blend and depth");
    }
    private static void lifecycle(Path root)throws Exception{
        org.boxutil.define.GLWrapper.init();check(GL11.glGetError()==0,"GLWrapper init error");
        class Batch extends WorkflowBatch {
            int registrations;
            Batch(){super(com.fs.starfarer.api.combat.CombatEngineLayers.BELOW_SHIPS_LAYER,"","",new float[]{-.2f,-.2f,.2f,-.2f,-.2f,.2f,.2f,.2f},32,0,false);}
            @Override protected int createProgram(){try{return program(root.resolve("VerifyInstancePlugin.vert"),root.resolve("VerifyInstancePlugin.frag"));}catch(Exception e){throw new RuntimeException(e);}}
            @Override protected void registerCombatCleanup(){registrations++;}
            @Override protected void bindSharedParameters(){}
            void color(Instance i,float r,float g){putFloat(i,0,r);putFloat(i,4,g);putFloat(i,12,1);putFloat(i,16,1);}
            float time(){return elapsed;}
        }
        boolean[] paused={false},over={false};
        var previous=com.fs.starfarer.api.Global.getCombatEngine();
        var engine=(com.fs.starfarer.api.combat.CombatEngineAPI)java.lang.reflect.Proxy.newProxyInstance(RenderRegression.class.getClassLoader(),new Class[]{com.fs.starfarer.api.combat.CombatEngineAPI.class},(o,m,a)->m.getName().equals("isPaused")?paused[0]:m.getName().equals("isCombatOver")?over[0]:null);
        var viewport=(com.fs.starfarer.api.combat.ViewportAPI)java.lang.reflect.Proxy.newProxyInstance(RenderRegression.class.getClassLoader(),new Class[]{com.fs.starfarer.api.combat.ViewportAPI.class},(o,m,a)->m.getName().equals("getAlphaMult")?1f:null);
        com.fs.starfarer.api.Global.setCombatEngine(engine);
        Batch batch=new Batch();
        try{
            batch.init(null);check(batch.program==null,"init must not allocate GPU resources");batch.advance(.5f);paused[0]=true;batch.advance(1);check(batch.time()==.5f,"pause freezes time");paused[0]=false;
            int ubo=buffer(GL31.GL_UNIFORM_BUFFER,80);FloatBuffer matrix=BufferUtils.createFloatBuffer(20);for(int i=0;i<20;i++)matrix.put(i<16&&i%5==0?1f:0f);matrix.flip();GL15.glBufferSubData(GL31.GL_UNIFORM_BUFFER,0,matrix);GL30.glBindBufferBase(GL31.GL_UNIFORM_BUFFER,0,ubo);
            batch.clearInstances();for(int i=0;i<20;i++){var item=batch.createInstance().setPosition((i%5-2)*.3f,(i/5-1.5f)*.3f).setScale(.4f,.4f);batch.color(item,1,0);}
            batch.render(com.fs.starfarer.api.combat.CombatEngineLayers.BELOW_SHIPS_LAYER,viewport);check(GL11.glGetError()==0,"first runtime render GL error");check(!batch.isExpired()&&batch.registrations==1,"batch initialized exactly once");
            int program=batch.program.getId();check(GL20.glIsProgram(program),"batch owns valid program");
            batch.clearInstances();var item=batch.createInstance();batch.color(item,0,1);batch.render(com.fs.starfarer.api.combat.CombatEngineLayers.BELOW_SHIPS_LAYER,viewport);check(GL11.glGetError()==0,"second runtime render GL error");check(batch.registrations==1,"second render reuses resources");item.remove();batch.render(com.fs.starfarer.api.combat.CombatEngineLayers.BELOW_SHIPS_LAYER,viewport);
            over[0]=true;batch.advance(0);check(batch.isExpired(),"combat completion expires batch");batch.cleanup();check(GL11.glGetError()==0,"first cleanup GL error");batch.cleanup();check(!GL20.glIsProgram(program),"program released exactly once");check(GL15.glIsBuffer(ubo),"borrowed global UBO remains alive");GL15.glDeleteBuffers(ubo);
            check(GL11.glGetError()==GL11.GL_NO_ERROR,"lifecycle GL error");System.out.println("PASS: actual runtime deferred initialization, 20-instance upload, reuse/removal, pause, combat completion and double cleanup");
        }finally{batch.cleanup();com.fs.starfarer.api.Global.setCombatEngine(previous);}
    }
    public static void main(String[] args)throws Exception{
        var vertexField=data.workflowshader.runtime.WorkflowShaderPlugin.class.getDeclaredField("VERTEX");vertexField.setAccessible(true);
        Files.writeString(Path.of(args[0],"VerifyJavaGraphPrototype.vert"),(String)vertexField.get(null));
        Files.writeString(Path.of(args[0],"VerifyJavaGraphPrototype.frag"),new data.workflowshader.compiler.FragmentCompiler().compile(data.workflowshader.WorkflowExamples.animatedNoise(),"output").source());
        Pbuffer context=new Pbuffer(128,128,new PixelFormat(),null,null,new ContextAttribs(4,3));
        try{context.makeCurrent();System.out.println("OpenGL: "+GL11.glGetString(GL11.GL_VERSION));List<Path> vertices;try(var stream=Files.list(Path.of(args[0]))){vertices=stream.filter(p->p.toString().endsWith(".vert")).sorted().toList();}
            for(Path v:vertices){Path f=Path.of(v.toString().replace(".vert",".frag"));int p=program(v,f);System.out.println("LINK: "+v.getFileName());if(v.getFileName().toString().equals("VerifyInstancePlugin.vert")){pixels(p);state(p);}GL20.glUseProgram(0);GL20.glDeleteProgram(p);}
            check(!vertices.isEmpty(),"No shaders to validate");check(GL11.glGetError()==GL11.GL_NO_ERROR,"OpenGL error after regression");lifecycle(Path.of(args[0]));System.out.println("PASS: linked "+vertices.size()+" shader pairs");
        }finally{context.destroy();}
    }
}
