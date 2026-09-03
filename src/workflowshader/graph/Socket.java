package data.workflowshader.graph;

/** Immutable typed port. Default expressions are GLSL literals used for unconnected inputs. */
public final class Socket {
    private final String name; private final ValueType type; private final String defaultExpression;
    public Socket(String name, ValueType type, String defaultExpression) {
        if (!name.matches("[A-Za-z_][A-Za-z0-9_]*")) throw new IllegalArgumentException("Invalid socket name: " + name);
        this.name=name; this.type=type; this.defaultExpression=defaultExpression;
    }
    public String name() { return name; } public ValueType type() { return type; } public String defaultExpression() { return defaultExpression; }
}
