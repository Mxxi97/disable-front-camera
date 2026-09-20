package drHirsch.disable_front_camera;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.CameraType;

/**
 * Fabric port of the NeoForge mod class under /src/main/java. Same logic, but
 * registered through Fabric API's client lifecycle events from the client
 * entrypoint declared in fabric.mod.json.
 *
 * fabric.mod.json declares "environment": "client", so a dedicated server never
 * loads this class.
 */
public class Disable_front_camera implements ClientModInitializer {
    public static final String MODID = "disable_front_camera";

    @Override
    public void onInitializeClient() {
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (client.options.keyTogglePerspective.isDown()) {

                if (client.options.getCameraType() == CameraType.THIRD_PERSON_FRONT) {
                    client.options.setCameraType(CameraType.FIRST_PERSON);

                }
            }
        });
    }
}
