package data.scripts.workflow;
import java.nio.*;
import java.nio.file.*;
import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.*;

/** 离屏对比冻结的迁移前算法，另链接真正从 EXE 下载的两个 shader。 */
public final class NoiseShaderCheck {
    static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
    static int shader(int type,String source){int s=GL20.glCreateShader(type);GL20.glShaderSource(s,source);GL20.glCompileShader(s);check(GL20.glGetShaderi(s,GL20.GL_COMPILE_STATUS)!=0,GL20.glGetShaderInfoLog(s,20000));return s;}
    static int program(String vertex,String fragment){int v=shader(GL20.GL_VERTEX_SHADER,vertex),f=shader(GL20.GL_FRAGMENT_SHADER,fragment),p=GL20.glCreateProgram();GL20.glAttachShader(p,v);GL20.glAttachShader(p,f);GL20.glLinkProgram(p);check(GL20.glGetProgrami(p,GL20.GL_LINK_STATUS)!=0,GL20.glGetProgramInfoLog(p,20000));GL20.glDeleteShader(v);GL20.glDeleteShader(f);return p;}
    static float[] pixels(int program){GL20.glUseProgram(program);GL11.glDrawArrays(GL11.GL_TRIANGLES,0,3);FloatBuffer pixels=BufferUtils.createFloatBuffer(32*32*4);GL11.glReadPixels(0,0,32,32,GL11.GL_RGBA,GL11.GL_FLOAT,pixels);float[] data=new float[pixels.remaining()];pixels.get(data);return data;}
    public static void main(String[] args)throws Exception{
        Pbuffer pbuffer=new Pbuffer(32,32,new PixelFormat(),null,null,new ContextAttribs(4,3));pbuffer.makeCurrent();
        int vao=GL30.glGenVertexArrays();GL30.glBindVertexArray(vao);
        int texture=GL11.glGenTextures();GL11.glBindTexture(GL11.GL_TEXTURE_2D,texture);GL11.glTexImage2D(GL11.GL_TEXTURE_2D,0,GL30.GL_RGBA32F,32,32,0,GL11.GL_RGBA,GL11.GL_FLOAT,(ByteBuffer)null);
        int fbo=GL30.glGenFramebuffers();GL30.glBindFramebuffer(GL30.GL_FRAMEBUFFER,fbo);GL30.glFramebufferTexture2D(GL30.GL_FRAMEBUFFER,GL30.GL_COLOR_ATTACHMENT0,GL11.GL_TEXTURE_2D,texture,0);check(GL30.glCheckFramebufferStatus(GL30.GL_FRAMEBUFFER)==GL30.GL_FRAMEBUFFER_COMPLETE,"Float framebuffer");
        GL11.glViewport(0,0,32,32);GL11.glDisable(GL11.GL_BLEND);GL11.glDisable(GL11.GL_DEPTH_TEST);
        String vertex="#version 430\nout vec2 v_uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);v_uv=(p-0.5)*vec2(4.2,3.4);gl_Position=vec4(p*2.0-1.0,0,1);}";
        // 修正语义的二维 Simplex 与 FBM 由 noise-mcp-acceptance 独立数值参考覆盖。
        String[] names={"value","perlin","worley","fbmWorley","turbulence","turbulize","turbulence3"};
        Path root=Path.of(args[0]);
        for(String name:names){
            int actual=program(vertex,Files.readString(root.resolve(name+".frag"))),reference=program(vertex,Files.readString(root.resolve(name+".reference.frag")));
            float[] a=pixels(actual),b=pixels(reference);float max=0;
            for(int i=0;i<a.length;i++){check(Float.isFinite(a[i])&&Float.isFinite(b[i]),name+" non-finite output");max=Math.max(max,Math.abs(a[i]-b[i]));}
            check(max<=0.001f,name+" changed pixels; max error="+max);
            int vp=program(Files.readString(root.resolve(name+".vert")),"#version 430\nin vec2 v_uv;out vec4 fragColor;void main(){fragColor=vec4(v_uv,0,1);}");
            GL20.glDeleteProgram(actual);GL20.glDeleteProgram(reference);GL20.glDeleteProgram(vp);
            System.out.println("PASS: "+name+"; 1024 float pixels, max error="+max+"; vertex link");
        }
        if(args.length>1){
            Path exported=Path.of(args[1]);
            try(var files=Files.walk(exported)){for(Path file:files.filter(p->p.toString().endsWith(".vert")).toList()){
                Path frag=Path.of(file.toString().replaceFirst("\\.vert$",".frag"));int p=program(Files.readString(file),Files.readString(frag));GL20.glDeleteProgram(p);System.out.println("PASS: actual UI export linked: "+file.getFileName());
            }}
        }
        check(GL11.glGetError()==GL11.GL_NO_ERROR,"OpenGL error");GL20.glUseProgram(0);GL30.glBindFramebuffer(GL30.GL_FRAMEBUFFER,0);GL30.glDeleteFramebuffers(fbo);GL11.glDeleteTextures(texture);GL30.glDeleteVertexArrays(vao);pbuffer.destroy();
    }
}
