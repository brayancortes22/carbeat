package com.bscl.carbeat;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Los plugins propios se registran antes de crear el puente de Capacitor.
        registerPlugin(CarModePlugin.class);
        registerPlugin(BackgroundAudioPlugin.class);
        super.onCreate(savedInstanceState);

        // El WebView es quien reproduce (HTML5 Audio / YouTube). Le pedimos al sistema que
        // no lo considere un renderer descartable cuando la pantalla se apaga: junto con el
        // servicio de audio, es lo que evita que la música se corte en segundo plano.
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        }
    }
}
