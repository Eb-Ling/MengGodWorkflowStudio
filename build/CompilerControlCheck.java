package data.scripts.workflow;
import java.nio.*;
import java.nio.file.*;
import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.*;

/** 公开 MCP 返回的两份 shader 原样链接并实例绘制，不调用 Studio 生成器。 */
public final class CompilerControlCheck {
  static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
  static int shader(int type,Path path)throws Exception{
    int s=GL20.glCreateShader(type);GL20.glShaderSource(s,Files.readString(path));GL20.glCompileShader(s);
    check(GL20.glGetShaderi(s,GL20.GL_COMPILE_STATUS)!=0,path+"\n"+GL20.glGetShaderInfoLog(s,20000));return s;
  }
  static int buffer(int target,float[] values){
    FloatBuffer data=BufferUtils.createFloatBuffer(values.length);data.put(values).flip();
    int b=GL15.glGenBuffers();GL15.glBindBuffer(target,b);GL15.glBufferData(target,data,GL15.GL_STATIC_DRAW);return b;
  }
  public static void main(String[] args)throws Exception{
    Pbuffer surface=new Pbuffer(32,32,new PixelFormat(),null,null,new ContextAttribs(4,3));surface.makeCurrent();
    int vao=GL30.glGenVertexArrays();GL30.glBindVertexArray(vao);
    int vbo=buffer(GL15.GL_ARRAY_BUFFER,new float[]{-.75f,-.75f,.75f,-.75f,-.75f,.75f,.75f,.75f});
    GL20.glEnableVertexAttribArray(0);GL20.glVertexAttribPointer(0,2,GL11.GL_FLOAT,false,8,0L);
    FloatBuffer identity=BufferUtils.createFloatBuffer(16);for(int i=0;i<16;i++)identity.put(i%5==0?1:0);identity.flip();
    int transforms=buffer(GL43.GL_SHADER_STORAGE_BUFFER,new float[]{1,0,0,0,1,1,0,0});GL30.glBindBufferBase(GL43.GL_SHADER_STORAGE_BUFFER,5,transforms);
    int parameters=buffer(GL43.GL_SHADER_STORAGE_BUFFER,new float[4]);GL30.glBindBufferBase(GL43.GL_SHADER_STORAGE_BUFFER,0,parameters);
    GL11.glViewport(0,0,32,32);GL11.glDisable(GL11.GL_BLEND);GL11.glDisable(GL11.GL_DEPTH_TEST);
    for(String kind:new String[]{"Loop","IfTrue","IfFalse"}){
      String name="Mcp"+kind+"Effect";Path dir;
      try(var files=Files.walk(Path.of(args[0],name,"data"))){var matches=files.filter(p->p.getFileName().toString().equals(name+".vert")).toList();check(matches.size()==1,"Expected exactly one vertex file");dir=matches.get(0).getParent();}
      int vs=shader(GL20.GL_VERTEX_SHADER,dir.resolve(name+".vert")),fs=shader(GL20.GL_FRAGMENT_SHADER,dir.resolve(name+".frag")),p=GL20.glCreateProgram();
      GL20.glAttachShader(p,vs);GL20.glAttachShader(p,fs);GL20.glLinkProgram(p);check(GL20.glGetProgrami(p,GL20.GL_LINK_STATUS)!=0,GL20.glGetProgramInfoLog(p,20000));
      GL20.glUseProgram(p);GL20.glUniformMatrix4(GL20.glGetUniformLocation(p,"u_viewProjection"),false,identity);
      GL20.glUniform1f(GL20.glGetUniformLocation(p,"u_viewportAlpha"),1);GL20.glUniform1i(GL20.glGetUniformLocation(p,"u_instanceOffset"),0);
      GL11.glClearColor(0,0,0,0);GL11.glClear(GL11.GL_COLOR_BUFFER_BIT);GL31.glDrawArraysInstanced(GL11.GL_TRIANGLE_STRIP,0,4,1);
      ByteBuffer pixel=BufferUtils.createByteBuffer(4);GL11.glReadPixels(16,16,1,1,GL11.GL_RGBA,GL11.GL_UNSIGNED_BYTE,pixel);
      int on=kind.equals("IfFalse")?1:0,off=1-on;
      check((pixel.get(on)&255)>250&&(pixel.get(off)&255)<5,name+" produced wrong branch/loop value");
      GL11.glReadPixels(0,0,1,1,GL11.GL_RGBA,GL11.GL_UNSIGNED_BYTE,pixel);check((pixel.get(0)&255)==0&&(pixel.get(1)&255)==0,"Outside geometry must remain empty");
      GL20.glDeleteShader(vs);GL20.glDeleteShader(fs);GL20.glDeleteProgram(p);System.out.println("PASS: actual MCP "+kind+" shader pixels and custom function");
    }
    GL20.glUseProgram(0);for(int b:new int[]{vbo,transforms,parameters})GL15.glDeleteBuffers(b);GL30.glDeleteVertexArrays(vao);
    check(GL11.glGetError()==0,"OpenGL error");surface.destroy();
  }
}
