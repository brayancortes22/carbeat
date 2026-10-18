package com.bscl.carbeat;

import android.view.View;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Modo carro: oculta la barra de estado y la de navegación de Android (pantalla completa
 * "inmersiva"). Si el conductor desliza desde el borde, las barras aparecen un momento y se
 * vuelven a ocultar solas.
 *
 * Se llama desde JavaScript con: CarMode.setImmersive({ on: true })  (ver src/app/native.ts)
 */
@CapacitorPlugin(name = "CarMode")
public class CarModePlugin extends Plugin {

    @PluginMethod
    public void setImmersive(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        getActivity().runOnUiThread(() -> {
            View decor = getActivity().getWindow().getDecorView();
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getActivity().getWindow(), decor);
            if (on) {
                controller.hide(WindowInsetsCompat.Type.systemBars());
                controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                controller.show(WindowInsetsCompat.Type.systemBars());
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            call.resolve();
        });
    }
}
