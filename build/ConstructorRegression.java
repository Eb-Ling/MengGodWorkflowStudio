package data.scripts.workflow;

import data.scripts.*;
import com.fs.starfarer.api.combat.CombatEngineLayers;
import java.lang.reflect.Field;
import java.nio.ByteBuffer;
import java.util.List;
import org.boxutil.define.struct.instance.Fixed2DStruct;
import org.lwjgl.util.vector.*;

/** Constructor tests run without a GL context: the caller only supplies configurations. */
public final class ConstructorRegression {
    private static Object field(Object object, Class<?> owner, String name) throws Exception {
        Field f=owner.getDeclaredField(name);f.setAccessible(true);return f.get(object);
    }
    private static void check(boolean condition,String message){if(!condition)throw new AssertionError(message);}
    private static ByteBuffer parameters(WorkflowBatch.Instance i)throws Exception{return (ByteBuffer)field(i,WorkflowBatch.Instance.class,"parameters");}
    private static void rejects(Runnable action){try{action.run();throw new AssertionError("Expected rejection");}catch(NullPointerException|IllegalArgumentException expected){}}
    public static void main(String[] args)throws Exception {
        CombatEngineLayers layer=CombatEngineLayers.BELOW_SHIPS_LAYER;
        Vector4f color=new Vector4f(1,0,0,1);
        VerifyInstancePlugin.InstanceParameters[] configs=new VerifyInstancePlugin.InstanceParameters[8];
        for(int n=0;n<8;n++)configs[n]=new VerifyInstancePlugin.InstanceParameters(new VerifyInstancePlugin.Transform(n*100,n*50,n*10,2,3),color,n+.5f);
        color.x=0;
        VerifyInstancePlugin effect=new VerifyInstancePlugin(layer,configs);
        List<?> instances=(List<?>)field(effect,WorkflowBatch.class,"instances");
        check(instances.size()==8,"Constructor must create exactly eight instances");
        for(int n=0;n<8;n++){
            WorkflowBatch.Instance i=effect.instance(n);check(i==instances.get(n),"Stable instance handle");
            float[] t=((Fixed2DStruct)field(i,WorkflowBatch.Instance.class,"transform")).getData();
            check(t[1]==n*10&&t[2]==n*100&&t[3]==n*50&&t[4]==2&&t[5]==3,"Independent transforms");
            ByteBuffer p=parameters(i);check(p.getFloat(0)==1&&p.getFloat(12)==1&&p.getFloat(16)==n+.5f,"All instance fields initialized, vectors copied");
        }
        VerifyInstancePlugin empty=new VerifyInstancePlugin(layer,new VerifyInstancePlugin.InstanceParameters[0]);
        check(((List<?>)field(empty,WorkflowBatch.class,"instances")).isEmpty(),"No hidden default instance");
        rejects(()->new VerifyInstancePlugin(layer,(VerifyInstancePlugin.InstanceParameters[])null));
        rejects(()->new VerifyInstancePlugin(layer,new VerifyInstancePlugin.InstanceParameters[]{null}));
        rejects(()->new VerifyInstancePlugin.Transform(Float.NaN,0));
        rejects(()->new VerifyInstancePlugin.InstanceParameters(new VerifyInstancePlugin.Transform(0,0),null,1));
        rejects(()->new VerifyInstancePlugin.InstanceParameters(new VerifyInstancePlugin.Transform(0,0),new Vector4f(1,1,1,1),Float.POSITIVE_INFINITY));
        VerifyUniformPlugin.SharedParameters shared=new VerifyUniformPlugin.SharedParameters(new Vector3f(1,2,3),.7f);
        VerifyUniformPlugin uniform=new VerifyUniformPlugin(layer,shared,new VerifyUniformPlugin.InstanceParameters(new VerifyUniformPlugin.Transform(10,20)));
        shared.color.x=9;
        check(((Vector3f)field(uniform,VerifyUniformPlugin.class,"shared_color")).x==1,"Shared values copied into plugin");
        check((Float)field(uniform,VerifyUniformPlugin.class,"shared_alpha")==.7f,"Shared scalar initialized");
        rejects(()->new VerifyTexturePlugin.SharedParameters(null));
        VerifyAbiPlugin abi=new VerifyAbiPlugin(layer,new VerifyAbiPlugin.InstanceParameters(new VerifyAbiPlugin.Transform(0,0),true,-9,-1,2.5f,new Vector2f(3,4),new Vector3f(5,6,7),new Vector4f(8,9,10,11)));
        ByteBuffer p=parameters(abi.instance(0));
        check(p.getInt(0)==1&&p.getInt(16)==-9&&p.getInt(32)==-1&&p.getFloat(48)==2.5f&&p.getFloat(68)==4&&p.getFloat(88)==7&&p.getFloat(108)==11,"Seven typed inputs match SSBO ABI");
        check(field(effect,WorkflowBatch.class,"program")==null,"Constructor must not allocate GL resources");
        System.out.println("PASS: generated constructors create exactly 8 instances, initialize all typed fields, preserve snapshots, reject invalid input and need no GL context");
    }
}
