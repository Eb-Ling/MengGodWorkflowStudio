package data.workflowshader.runtime;

import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.*;
import java.nio.IntBuffer;

/** Saves only mutable state touched by WorkflowShaderPlugin; no deprecated matrix stack/attrib stack use. */
final class GlStateGuard implements AutoCloseable {
    private final int program,vao,arrayBuffer,elementBuffer,srcRgb,dstRgb,srcAlpha,dstAlpha;
    private final boolean blend;
    private GlStateGuard(){program=GL11.glGetInteger(GL20.GL_CURRENT_PROGRAM);vao=GL11.glGetInteger(GL30.GL_VERTEX_ARRAY_BINDING);arrayBuffer=GL11.glGetInteger(GL15.GL_ARRAY_BUFFER_BINDING);elementBuffer=GL11.glGetInteger(GL15.GL_ELEMENT_ARRAY_BUFFER_BINDING);blend=GL11.glIsEnabled(GL11.GL_BLEND);srcRgb=GL11.glGetInteger(GL14.GL_BLEND_SRC_RGB);dstRgb=GL11.glGetInteger(GL14.GL_BLEND_DST_RGB);srcAlpha=GL11.glGetInteger(GL14.GL_BLEND_SRC_ALPHA);dstAlpha=GL11.glGetInteger(GL14.GL_BLEND_DST_ALPHA);}
    static GlStateGuard capture(){return new GlStateGuard();}
    @Override public void close(){GL20.glUseProgram(program);GL30.glBindVertexArray(vao);GL15.glBindBuffer(GL15.GL_ARRAY_BUFFER,arrayBuffer);GL15.glBindBuffer(GL15.GL_ELEMENT_ARRAY_BUFFER,elementBuffer);if(blend)GL11.glEnable(GL11.GL_BLEND);else GL11.glDisable(GL11.GL_BLEND);GL14.glBlendFuncSeparate(srcRgb,dstRgb,srcAlpha,dstAlpha);}
}
