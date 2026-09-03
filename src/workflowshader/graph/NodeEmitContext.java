package data.workflowshader.graph;

/** Access to input expressions while one graph node is lowered into GLSL. */
public interface NodeEmitContext { String input(String inputSocket); }
