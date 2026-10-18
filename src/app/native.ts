// Puente con Android (Capacitor). Todo es a prueba de web: si no hay plataforma nativa, no hace
// nada. Así la app se puede probar en el navegador con `npm run dev:app`.

import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';

export const isNative = Capacitor.isNativePlatform();

/** Plugin propio (MainActivity.java): oculta barras de estado y navegación en modo carro. */
const CarMode = registerPlugin<{ setImmersive(o: { on: boolean }): Promise<void> }>('CarMode');

export const native = {
  async haptic(kind: 'tap' | 'select' | 'success' | 'warn' = 'tap'): Promise<void> {
    if (!isNative) {
      navigator.vibrate?.(kind === 'success' ? [12, 40, 12] : 10);
      return;
    }
    try {
      if (kind === 'tap') await Haptics.impact({ style: ImpactStyle.Light });
      else if (kind === 'select') await Haptics.selectionChanged();
      else if (kind === 'success') await Haptics.notification({ type: NotificationType.Success });
      else await Haptics.notification({ type: NotificationType.Warning });
    } catch {
      /* sin motor de vibración */
    }
  },

  async boot(): Promise<void> {
    if (!isNative) return;
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#05070a' });
    } catch {
      /* Android 15+ dibuja de borde a borde: el color lo pone el WebView */
    }
    await SplashScreen.hide().catch(() => {});
  },

  /** Modo carro: pantalla completa, siempre encendida y en horizontal. */
  async carMode(on: boolean): Promise<void> {
    if (!isNative) return;
    await Promise.allSettled([
      CarMode.setImmersive({ on }),
      on ? KeepAwake.keepAwake() : KeepAwake.allowSleep(),
      on ? ScreenOrientation.lock({ orientation: 'landscape' }) : ScreenOrientation.unlock(),
    ]);
  },

  async share(title: string, text: string, url: string): Promise<void> {
    if (isNative) {
      await Share.share({ title, text, url, dialogTitle: 'Invitar al carro' }).catch(() => {});
      return;
    }
    if (navigator.share) await navigator.share({ title, text, url }).catch(() => {});
    else await navigator.clipboard?.writeText(url).catch(() => {});
  },

  /** Botón atrás de Android. El manejador devuelve true si lo consumió. */
  onBack(handler: () => boolean): () => void {
    if (!isNative) return () => {};
    const sub = App.addListener('backButton', () => {
      if (!handler()) void App.minimizeApp();
    });
    return () => void sub.then((s) => s.remove());
  },
};
