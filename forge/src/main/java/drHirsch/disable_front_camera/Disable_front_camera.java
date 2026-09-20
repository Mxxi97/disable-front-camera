package drHirsch.disable_front_camera;

import net.minecraft.client.CameraType;
import net.minecraft.client.Minecraft;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.fml.common.Mod;

/**
 * Forge port of the NeoForge mod class under /src/main/java. Same logic, but
 * Forge's rewritten event bus (EventBus 7, Forge 62+/Minecraft 26.1+) subscribes
 * through the per-event BUS constant instead of NeoForge's annotation scanning.
 *
 * Registering straight from the constructor is safe on a dedicated server only
 * because mods.toml declares clientSideOnly=true, so FML never loads this class
 * there.
 */
@Mod(Disable_front_camera.MODID)
public class Disable_front_camera {
    public static final String MODID = "disable_front_camera";

    public Disable_front_camera() {
        TickEvent.ClientTickEvent.Post.BUS.addListener(event -> {
            if (Minecraft.getInstance().options.keyTogglePerspective.isDown()) {

                if (Minecraft.getInstance().options.getCameraType() == CameraType.THIRD_PERSON_FRONT) {
                    Minecraft.getInstance().options.setCameraType(CameraType.FIRST_PERSON);

                }
            }
        });
    }
}
