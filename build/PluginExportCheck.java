package data.scripts.workflow;
import java.nio.file.*;
import org.lwjgl.opengl.*;
/** 链接实际用户路径导出的 shader，不调用 Studio 生成器。 */
public final class PluginExportCheck {
  static int compile(int type,String text){int s=GL20.glCreateShader(type);GL20.glShaderSource(s,text);GL20.glCompileShader(s);if(GL20.glGetShaderi(s,GL20.GL_COMPILE_STATUS)==0)throw new AssertionError(GL20.glGetShaderInfoLog(s,20000));return s;}
  public static void main(String[] args)throws Exception{
    Pbuffer buffer=new Pbuffer(16,16,new PixelFormat(),null,null,new ContextAttribs(4,3));buffer.makeCurrent();int count=0;
    for(String directory:args)try(var files=Files.walk(Path.of(directory))){for(Path v:files.filter(p->p.toString().endsWith(".vert")).toList()){
      Path f=Path.of(v.toString().replaceFirst("\\.vert$",".frag"));int vs=compile(GL20.GL_VERTEX_SHADER,Files.readString(v)),fs=compile(GL20.GL_FRAGMENT_SHADER,Files.readString(f)),p=GL20.glCreateProgram();GL20.glAttachShader(p,vs);GL20.glAttachShader(p,fs);GL20.glLinkProgram(p);if(GL20.glGetProgrami(p,GL20.GL_LINK_STATUS)==0)throw new AssertionError(GL20.glGetProgramInfoLog(p,20000));GL20.glDeleteProgram(p);GL20.glDeleteShader(vs);GL20.glDeleteShader(fs);count++;System.out.println("PASS: actual export linked "+v.getFileName());
    }}buffer.destroy();if(count<5)throw new AssertionError("Expected desktop and MCP exports");
  }
}
