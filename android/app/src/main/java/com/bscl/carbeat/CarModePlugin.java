package com.bscl.carbeat;

import android.view.View;
import android.view.Window;
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
 * También controla el brillo de la ventana para el modo «pantalla apagada»: deja el panel en
 * negro sin detener el WebView, de modo que YouTube (que se pausa si el sistema apaga la
 * pantalla) sigue sonando.
 *
 * Se llama desde JavaScript con: CarMode.setImmersive({ on: true }) y
 * CarMode.setScreenDim({ on: true })  (ver src/app/native.ts)
 */
@CapacitorPlugin(name = "CarMode")
public class CarModePlugin extends Plugin {

    private boolean dimmed = false;

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

    @PluginMethod
    public void setScreenDim(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        getActivity().runOnUiThread(() -> {
            setWindowBrightness(on ? 0f : WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE);
            dimmed = on;
            if (on) {
                // El panel sigue «encendido» para Android (sólo se apaga la luz), así que
                // YouTube y el WebView no reciben la señal de pantalla apagada.
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            call.resolve();
        });
    }

    private void setWindowBrightness(float value) {
        Window window = getActivity().getWindow();
        WindowManager.LayoutParams params = window.getAttributes();
        params.screenBrightness = value;
        window.setAttributes(params);
    }

    @Override
    protected void handleOnPause() {
        // Si el usuario sale a Inicio o llega un diálogo del sistema, devolvemos el brillo
        // para no dejar una ventana negra invisible al volver.
        if (dimmed) {
            dimmed = false;
            setWindowBrightness(WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE);
        }
    }
}
