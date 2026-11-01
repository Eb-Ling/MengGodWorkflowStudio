package data.scripts.workflow;

import org.lwjgl.opengl.*;

/** Restores exactly the state touched by WorkflowBatch, including indexed SSBO ranges. */
final class WorkflowGlState implements AutoCloseable {
    private final int program = GL11.glGetInteger(GL20.GL_CURRENT_PROGRAM);
    private final int vao = GL11.glGetInteger(GL30.GL_VERTEX_ARRAY_BINDING);
    private final int array = GL11.glGetInteger(GL15.GL_ARRAY_BUFFER_BINDING);
    private final int ssbo = GL11.glGetInteger(GL43.GL_SHADER_STORAGE_BUFFER_BINDING);
    private final int activeTexture = GL11.glGetInteger(GL13.GL_ACTIVE_TEXTURE);
    private final int srcRgb = GL11.glGetInteger(GL14.GL_BLEND_SRC_RGB), dstRgb = GL11.glGetInteger(GL14.GL_BLEND_DST_RGB);
    private final int srcAlpha = GL11.glGetInteger(GL14.GL_BLEND_SRC_ALPHA), dstAlpha = GL11.glGetInteger(GL14.GL_BLEND_DST_ALPHA);
    private final int equationRgb = GL11.glGetInteger(GL20.GL_BLEND_EQUATION_RGB), equationAlpha = GL11.glGetInteger(GL20.GL_BLEND_EQUATION_ALPHA);
    private final boolean blend = GL11.glIsEnabled(GL11.GL_BLEND), depth = GL11.glIsEnabled(GL11.GL_DEPTH_TEST), cull = GL11.glIsEnabled(GL11.GL_CULL_FACE);
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
        enable(GL11.GL_BLEND,blend);enable(GL11.GL_DEPTH_TEST,depth);enable(GL11.GL_CULL_FACE,cull);GL11.glDepthMask(depthMask);
        GL14.glBlendFuncSeparate(srcRgb,dstRgb,srcAlpha,dstAlpha);GL20.glBlendEquationSeparate(equationRgb,equationAlpha);
    }
}
