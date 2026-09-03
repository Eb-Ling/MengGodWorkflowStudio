package data.workflowshader.nodes;

import data.workflowshader.graph.*;
import java.util.*;

/** Graph terminal; its color input is written to the fragment target. */
public final class OutputNode extends Node {
    public OutputNode(String id) { super(id,"Fragment Output");input("color",ValueType.VEC4,"vec4(0.0)"); }
    @Override public Map<String,String> emit(NodeEmitContext context) { return Collections.emptyMap(); }
}
