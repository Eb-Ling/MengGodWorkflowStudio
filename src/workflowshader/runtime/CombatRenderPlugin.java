package data.workflowshader.runtime;

import com.fs.starfarer.api.combat.*;
import java.util.EnumSet;

/**
 * Complete compatibility surface for Starsector's public CombatLayeredRenderingPlugin API.
 * "CombatRenderPlugin" is retained as the workflow-facing name; it is directly engine-compatible.
 */
public class CombatRenderPlugin extends BaseCombatLayeredRenderingPlugin {
    public CombatRenderPlugin(){super();} public CombatRenderPlugin(CombatEngineLayers layer){super(layer);}
    @Override public void init(CombatEntityAPI entity){super.init(entity);} @Override public void cleanup(){} @Override public boolean isExpired(){return false;} @Override public void advance(float amount){}
    @Override public EnumSet<CombatEngineLayers> getActiveLayers(){return super.getActiveLayers();} @Override public float getRenderRadius(){return 100f;} @Override public void render(CombatEngineLayers layer,ViewportAPI viewport){}
}
