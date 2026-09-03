package data.workflowshader.graph;

import java.util.*;

/** A directed typed graph. One input can have only one incoming link. */
public final class Graph {
    public static final class Link { public final String fromNode,fromSocket,toNode,toSocket; private Link(String a,String b,String c,String d){fromNode=a;fromSocket=b;toNode=c;toSocket=d;} }
    private final Map<String,Node> nodes=new LinkedHashMap<String,Node>(); private final List<Link> links=new ArrayList<Link>();
    public Graph add(Node node) { if(nodes.put(node.id(),node)!=null) throw new IllegalArgumentException("Duplicate node: "+node.id()); return this; }
    public Graph connect(String fromNode,String fromSocket,String toNode,String toSocket) {
        Socket out=require(fromNode).output(fromSocket), in=require(toNode).input(toSocket);
        if(out==null||in==null) throw new IllegalArgumentException("Unknown port in "+fromNode+"."+fromSocket+" -> "+toNode+"."+toSocket);
        if(out.type()!=in.type()) throw new IllegalArgumentException("Port type mismatch: "+out.type()+" -> "+in.type());
        for(Iterator<Link> it=links.iterator();it.hasNext();) { Link l=it.next();if(l.toNode.equals(toNode)&&l.toSocket.equals(toSocket))it.remove(); }
        links.add(new Link(fromNode,fromSocket,toNode,toSocket)); return this;
    }
    public Node require(String id) { Node n=nodes.get(id);if(n==null)throw new IllegalArgumentException("Unknown node: "+id);return n; }
    public Collection<Node> nodes() { return Collections.unmodifiableCollection(nodes.values()); } public List<Link> links() { return Collections.unmodifiableList(links); }
    public Link incoming(String node,String socket) { for(Link link:links)if(link.toNode.equals(node)&&link.toSocket.equals(socket))return link; return null; }
}
