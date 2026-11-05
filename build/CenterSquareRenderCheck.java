package data.scripts.workflow;

import com.fs.starfarer.api.Global;
import com.fs.starfarer.api.SettingsAPI;
import com.fs.starfarer.api.combat.*;
import data.methods.WorkflowRuntime;
import data.scripts.CenterSquareTest;
import java.awt.image.BufferedImage;
import java.lang.reflect.Proxy;
import java.nio.ByteBuffer;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.*;
import org.lwjgl.util.vector.Vector2f;

/** 只编译并调用编辑器下载的原始文件，模拟世界视口，在真实 GL 上检查中心与方形边界。 */
public final class CenterSquareRenderCheck {
    private static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
    private static int[] draw(CenterSquareTest effect,ViewportAPI viewport,CombatEngineLayers layer){
        GL11.glClearColor(0,0,0,0);GL11.glClear(GL11.GL_COLOR_BUFFER_BIT);
        effect.render(layer,viewport);GL11.glFinish();
        ByteBuffer pixels=BufferUtils.createByteBuffer(256*256*4);GL11.glReadPixels(0,0,256,256,GL11.GL_RGBA,GL11.GL_UNSIGNED_BYTE,pixels);
        int minX=256,minY=256,maxX=-1,maxY=-1;
        for(int y=0;y<256;y++)for(int x=0;x<256;x++)if((pixels.get((y*256+x)*4+2)&255)>20){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
        return new int[]{minX,minY,maxX,maxY};
    }
    private static void camera(float x,float y,float halfSize){
        GL11.glMatrixMode(GL11.GL_PROJECTION);GL11.glLoadIdentity();GL11.glOrtho(-halfSize,halfSize,-halfSize,halfSize,-1,1);
        GL11.glMatrixMode(GL11.GL_MODELVIEW);GL11.glLoadIdentity();GL11.glTranslatef(-x,-y,0);
    }
    private static void bounds(int[] actual,int... expected){check(Arrays.equals(actual,expected),"World-space square bounds: "+Arrays.toString(actual)+", expected "+Arrays.toString(expected));}
    private static void screenshot(Path file)throws Exception{
        ByteBuffer pixels=BufferUtils.createByteBuffer(256*256*4);GL11.glReadPixels(0,0,256,256,GL11.GL_RGBA,GL11.GL_UNSIGNED_BYTE,pixels);
        BufferedImage image=new BufferedImage(256,256,BufferedImage.TYPE_INT_ARGB);
        for(int y=0;y<256;y++)for(int x=0;x<256;x++){int p=(y*256+x)*4;image.setRGB(x,255-y,0xff000000|((pixels.get(p)&255)<<16)|((pixels.get(p+1)&255)<<8)|(pixels.get(p+2)&255));}
        ImageIO.write(image,"png",file.toFile());
    }
    public static void main(String[] args)throws Exception{
        Path exported=Path.of(args[0]),evidence=exported.getParent();
        var previousEngine=Global.getCombatEngine();var previousSettings=Global.getSettings();
        Map<String,Object> custom=new HashMap<>();
        CombatEngineAPI engine=(CombatEngineAPI)Proxy.newProxyInstance(CenterSquareRenderCheck.class.getClassLoader(),new Class<?>[]{CombatEngineAPI.class},(o,m,a)->switch(m.getName()){
            case "getCustomData"->custom;case "isCombatOver","isPaused"->false;default->throw new UnsupportedOperationException(m.getName());});
        Global.setCombatEngine(engine);
        Global.setSettings((SettingsAPI)Proxy.newProxyInstance(CenterSquareRenderCheck.class.getClassLoader(),new Class<?>[]{SettingsAPI.class},(o,m,a)->switch(m.getName()){
            case "loadText"->Files.readString(exported.resolve((String)a[0]));case "getScreenScaleMult"->1f;case "getBoolean"->false;default->throw new UnsupportedOperationException(m.getName());}));
        ViewportAPI viewport=(ViewportAPI)Proxy.newProxyInstance(CenterSquareRenderCheck.class.getClassLoader(),new Class<?>[]{ViewportAPI.class},(o,m,a)->m.getName().equals("getAlphaMult")?1f:null);
        CombatEngineLayers layer=CombatEngineLayers.ABOVE_SHIPS_LAYER;
        Vector2f center=new Vector2f(1800,-750);
        CenterSquareTest effect=new CenterSquareTest(layer,center);
        center.set(0,0); // 构造快照不能被外部向量修改。
        check(WorkflowRuntime.class.getSuperclass()==Object.class,"No Base rendering superclass");
        Pbuffer surface=new Pbuffer(256,256,new PixelFormat(),null,null,new ContextAttribs(4,3).withProfileCompatibility(true));
        try{
            surface.makeCurrent();org.boxutil.define.GLWrapper.init();GL11.glViewport(0,0,256,256);
            try(var box=new RuntimeSafetyCheck.BoxState(0)){
                effect.init(null);
                GL11.glEnable(GL11.GL_ALPHA_TEST);GL11.glAlphaFunc(GL11.GL_GREATER,.9f);
                camera(1800,-750,400);
                bounds(draw(effect,viewport,layer),64,64,191,191);
                screenshot(evidence.resolve("native-square.png"));
                check(GL11.glIsEnabled(GL11.GL_ALPHA_TEST)&&GL11.glGetFloat(GL11.GL_ALPHA_TEST_REF)==.9f,"Inherited alpha state restored");
                camera(1900,-750,400);bounds(draw(effect,viewport,layer),32,64,159,191);
                camera(1800,-750,800);bounds(draw(effect,viewport,layer),96,96,159,159);
                effect.instance(0).setPosition(new Vector2f(2000,-550));
                camera(2000,-550,400);bounds(draw(effect,viewport,layer),64,64,191,191);
                bounds(draw(effect,viewport,CombatEngineLayers.BELOW_SHIPS_LAYER),256,256,-1,-1);
                effect.markExpired();bounds(draw(effect,viewport,layer),256,256,-1,-1);
                effect.cleanup();effect.cleanup();
                check(GL11.glGetError()==0,"No GL errors");
                System.out.println("PASS: unchanged UI-exported CenterSquareTest + data.methods runtime compile and render through CombatLayeredRenderingPlugin");
                System.out.println("PASS: Vector2f(1800,-750) snapshot; 400x400 world square; camera pan, 2x zoom-out and Vector2f follow updates");
                System.out.println("PASS: alpha 0.65 visible under inherited threshold 0.9; global BoxUtil matrix UBO absent; wrong layer and expired effect draw nothing; cleanup twice");
            }
        }finally{surface.destroy();Global.setCombatEngine(previousEngine);Global.setSettings(previousSettings);}
    }
}
