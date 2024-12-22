package drHirsch.disable_front_camera;

import net.minecraft.client.CameraType;
import net.minecraft.client.Minecraft;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.client.event.ClientTickEvent;

@Mod(Disable_front_camera.MODID)
public class Disable_front_camera {
    public static final String MODID = "disable_front_camera";

    public Disable_front_camera(IEventBus modEventBus, ModContainer modContainer) {

    }

    @EventBusSubscriber(modid = Disable_front_camera.MODID, value = Dist.CLIENT)
    public static class ClientModEvents {

        @SubscribeEvent
        public static void onCameraChange(ClientTickEvent.Post event) {
            if (Minecraft.getInstance().options.keyTogglePerspective.isDown()) {

                if (Minecraft.getInstance().options.getCameraType() == CameraType.THIRD_PERSON_FRONT) {
                    Minecraft.getInstance().options.setCameraType(CameraType.FIRST_PERSON);

                }
            }
        }
    }
}
