package com.bscl.carbeat;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Puente JS <-> servicio de audio en segundo plano.
 *
 * Se llama desde src/app/native.ts mientras la cabina está encendida y hay una pista cargada.
 * El servicio mantiene el proceso vivo y publica la notificación/MediaSession; el audio real
 * sigue siendo el del WebView.
 */
@CapacitorPlugin(name = "BackgroundAudio")
public class BackgroundAudioPlugin extends Plugin {

    private static BackgroundAudioPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
    }

    @PluginMethod
    public void enable(PluginCall call) {
        startService(call, BackgroundAudioService.ACTION_START);
    }

    @PluginMethod
    public void update(PluginCall call) {
        startService(call, BackgroundAudioService.ACTION_UPDATE);
    }

    @PluginMethod
    public void disable(PluginCall call) {
        Context context = getContext();
        context.stopService(new Intent(context, BackgroundAudioService.class));
        call.resolve();
    }

    private void startService(PluginCall call, String action) {
        Context context = getContext();
        Double position = call.getDouble("position", 0.0);
        Double duration = call.getDouble("duration", 0.0);

        Intent intent = new Intent(context, BackgroundAudioService.class)
                .setAction(action)
                .putExtra(BackgroundAudioService.EXTRA_TITLE, call.getString("title", ""))
                .putExtra(BackgroundAudioService.EXTRA_ARTIST, call.getString("artist", ""))
                .putExtra(BackgroundAudioService.EXTRA_ALBUM, call.getString("album", ""))
                .putExtra(BackgroundAudioService.EXTRA_COVER_URL, call.getString("coverUrl", ""))
                .putExtra(BackgroundAudioService.EXTRA_PLAYING, Boolean.TRUE.equals(call.getBoolean("playing", false)))
                .putExtra(BackgroundAudioService.EXTRA_POSITION_MS, secondsToMillis(position))
                .putExtra(BackgroundAudioService.EXTRA_DURATION_MS, secondsToMillis(duration));

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            call.resolve();
        } catch (Exception error) {
            // Android puede rechazar un FGS nacido en segundo plano (por ejemplo, si el
            // WebView intenta actualizar metadatos mientras la app está dormida). No es
            // fatal: el WebView sigue sonando y el servicio se reengancha al volver.
            call.reject("No se pudo mantener la música en segundo plano", error);
        }
    }

    private static long secondsToMillis(Double seconds) {
        if (seconds == null || seconds.isNaN() || seconds.isInfinite() || seconds < 0) return 0;
        return Math.round(seconds * 1000.0);
    }

    /** Llamado por el servicio (incluidos los botones de la notificación y del bloqueo). */
    static void dispatchMediaAction(final String action) {
        final BackgroundAudioPlugin plugin = instance;
        if (plugin == null) return;
        new Handler(Looper.getMainLooper()).post(() -> {
            JSObject data = new JSObject();
            data.put("action", action);
            plugin.notifyListeners("mediaAction", data);
        });
    }
}
