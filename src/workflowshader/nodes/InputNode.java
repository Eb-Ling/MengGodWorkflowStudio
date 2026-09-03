package data.workflowshader.nodes;

import data.workflowshader.graph.*;
import java.util.*;

/** User-defined runtime input. It becomes a GLSL uniform named u_*. */
public final class InputNode extends Node {
    private final String uniform;
    public InputNode(String id,String uniform,ValueType type) { super(id,"Input: "+uniform); if(!uniform.matches("u_[A-Za-z0-9_]+"))throw new IllegalArgumentException("Custom inputs must start with u_: "+uniform);this.uniform=uniform;output("value",type); }
    public String uniform() { return uniform; }
    @Override public Map<String,String> emit(NodeEmitContext context) { return Collections.singletonMap("value",uniform); }
}
