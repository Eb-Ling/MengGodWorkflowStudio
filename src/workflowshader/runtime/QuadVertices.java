package data.workflowshader.runtime;

/** Immutable four-corner local geometry required by every WorkflowShaderPlugin instance. */
public final class QuadVertices {
    private final float[] xy;
    /** Vertex order is triangle-strip: bottom-left, bottom-right, top-left, top-right. */
    public QuadVertices(float x0,float y0,float x1,float y1,float x2,float y2,float x3,float y3) { xy=new float[]{x0,y0,x1,y1,x2,y2,x3,y3}; }
    public float[] copy() { return xy.clone(); }
    public float maxRadius() { float r=0f;for(int i=0;i<xy.length;i+=2)r=Math.max(r,(float)Math.sqrt(xy[i]*xy[i]+xy[i+1]*xy[i+1]));return r; }
    public static QuadVertices centered(float width,float height) { if(width<=0||height<=0)throw new IllegalArgumentException("Size must be positive");float x=width*.5f,y=height*.5f;return new QuadVertices(-x,-y,x,-y,-x,y,x,y); }
}
