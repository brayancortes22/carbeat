import { Component, type ErrorInfo, type ReactNode } from 'react';
import { setGraphicsPreference } from '../core/device/graphics-detector';

/** Si algo revienta en la interfaz, el carro muestra un testigo o permite recuperar en modo 2D. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[CarBeat] error de interfaz:', error, info.componentStack);
  }

  private handleFallback2D = () => {
    setGraphicsPreference('2d');
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const msg = error.message || '';
    const isWebGL =
      msg.toLowerCase().includes('webgl') ||
      msg.toLowerCase().includes('three') ||
      msg.toLowerCase().includes('context');

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-asphalt p-6 text-center" role="alert">
        <span
          className={`h-14 w-14 rounded-full border-2 ${isWebGL ? 'border-cyan shadow-[0_0_24px_rgb(34_211_238/0.6)]' : 'border-danger shadow-[0_0_24px_rgb(255_69_58/0.6)]'}`}
          aria-hidden="true"
        />
        <h1 className="font-display text-3xl font-bold tracking-wide text-ink uppercase">
          {isWebGL ? 'Pantalla sin aceleración 3D' : 'Fallo en la cabina'}
        </h1>
        <p className="readout max-w-md rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-dim">
          {isWebGL
            ? 'Tu pantalla de auto o navegador no soporta gráficos 3D (WebGL). CarBeat funciona perfectamente en Modo 2D Ligero.'
            : msg}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {isWebGL && (
            <button
              type="button"
              onClick={this.handleFallback2D}
              className="rounded-xl border border-cyan/60 bg-cyan/20 px-6 py-3 font-display font-semibold tracking-[0.12em] text-ice uppercase transition-all hover:bg-cyan/30"
            >
              🚗 Entrar en Modo 2D Ligero
            </button>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-display font-semibold tracking-[0.12em] text-faint uppercase hover:text-ink"
          >
            Reiniciar
          </button>
        </div>
      </div>
    );
  }
}
