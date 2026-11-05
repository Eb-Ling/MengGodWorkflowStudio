package data.scripts.workflow;
import java.nio.*;
import java.nio.file.*;
import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.*;
/** 独立公式和真实节点编译结果比较，覆盖淡出边缘、布尔逻辑、输入与纹理。 */
public final class BuiltinShaderCheck {
 static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
 static int shader(int type,String source){int s=GL20.glCreateShader(type);GL20.glShaderSource(s,source);GL20.glCompileShader(s);check(GL20.glGetShaderi(s,GL20.GL_COMPILE_STATUS)!=0,GL20.glGetShaderInfoLog(s,20000));return s;}
 static int program(String fragment){String vertex="#version 430\nout vec2 v_uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);v_uv=p;gl_Position=vec4(p*2.0-1.0,0,1);}";int v=shader(GL20.GL_VERTEX_SHADER,vertex),f=shader(GL20.GL_FRAGMENT_SHADER,fragment),p=GL20.glCreateProgram();GL20.glAttachShader(p,v);GL20.glAttachShader(p,f);GL20.glLinkProgram(p);check(GL20.glGetProgrami(p,GL20.GL_LINK_STATUS)!=0,GL20.glGetProgramInfoLog(p,20000));GL20.glDeleteShader(v);GL20.glDeleteShader(f);return p;}
 static float[] pixels(int p){GL20.glUseProgram(p);GL20.glUniform1f(GL20.glGetUniformLocation(p,"u_time"),.37f);GL20.glUniform1f(GL20.glGetUniformLocation(p,"u_test"),.25f);GL20.glUniform1i(GL20.glGetUniformLocation(p,"u_texture"),0);GL20.glUniform2f(GL20.glGetUniformLocation(p,"u_textureAspect_u_texture"),1,1);GL11.glDrawArrays(GL11.GL_TRIANGLES,0,3);FloatBuffer pixels=BufferUtils.createFloatBuffer(32*32*4);GL11.glReadPixels(0,0,32,32,GL11.GL_RGBA,GL11.GL_FLOAT,pixels);float[] data=new float[pixels.remaining()];pixels.get(data);return data;}
 public static void main(String[] args)throws Exception{
  Pbuffer buffer=new Pbuffer(32,32,new PixelFormat(),null,null,new ContextAttribs(4,3));buffer.makeCurrent();int vao=GL30.glGenVertexArrays();GL30.glBindVertexArray(vao);
  int target=GL11.glGenTextures();GL11.glBindTexture(GL11.GL_TEXTURE_2D,target);GL11.glTexImage2D(GL11.GL_TEXTURE_2D,0,GL30.GL_RGBA32F,32,32,0,GL11.GL_RGBA,GL11.GL_FLOAT,(ByteBuffer)null);int fbo=GL30.glGenFramebuffers();GL30.glBindFramebuffer(GL30.GL_FRAMEBUFFER,fbo);GL30.glFramebufferTexture2D(GL30.GL_FRAMEBUFFER,GL30.GL_COLOR_ATTACHMENT0,GL11.GL_TEXTURE_2D,target,0);check(GL30.glCheckFramebufferStatus(GL30.GL_FRAMEBUFFER)==GL30.GL_FRAMEBUFFER_COMPLETE,"Float framebuffer");
  int texture=GL11.glGenTextures();GL11.glBindTexture(GL11.GL_TEXTURE_2D,texture);FloatBuffer data=BufferUtils.createFloatBuffer(4);data.put(new float[]{.2f,.4f,.6f,1}).flip();GL11.glTexImage2D(GL11.GL_TEXTURE_2D,0,GL30.GL_RGBA32F,1,1,0,GL11.GL_RGBA,GL11.GL_FLOAT,data);GL11.glTexParameteri(GL11.GL_TEXTURE_2D,GL11.GL_TEXTURE_MIN_FILTER,GL11.GL_NEAREST);GL11.glTexParameteri(GL11.GL_TEXTURE_2D,GL11.GL_TEXTURE_MAG_FILTER,GL11.GL_NEAREST);
  GL11.glViewport(0,0,32,32);GL11.glDisable(GL11.GL_BLEND);GL11.glDisable(GL11.GL_DEPTH_TEST);Path root=Path.of(args[0]);String[] names;try(var paths=Files.list(root)){names=paths.map(p->p.getFileName().toString()).filter(n->n.endsWith(".reference.frag")).map(n->n.replace(".reference.frag","")).sorted().toArray(String[]::new);}check(names.length==17,"All 17 built-in pixel cases required");
  for(String name:names){int actual=program(Files.readString(root.resolve(name+".frag"))),reference=program(Files.readString(root.resolve(name+".reference.frag")));float[] a=pixels(actual),b=pixels(reference);float max=0;for(int i=0;i<a.length;i++){check(Float.isFinite(a[i])&&Float.isFinite(b[i]),name+" non-finite output");max=Math.max(max,Math.abs(a[i]-b[i]));}check(max<=0.00001f,name+" changed pixels: "+max);System.out.println("PASS: "+name+"; 1024 float pixels, max error="+max);GL20.glDeleteProgram(actual);GL20.glDeleteProgram(reference);}
  check(GL11.glGetError()==GL11.GL_NO_ERROR,"OpenGL error");GL20.glUseProgram(0);GL30.glBindFramebuffer(GL30.GL_FRAMEBUFFER,0);GL30.glDeleteFramebuffers(fbo);GL11.glDeleteTextures(texture);GL11.glDeleteTextures(target);GL30.glDeleteVertexArrays(vao);buffer.destroy();
 }
}
