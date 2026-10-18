import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Si algo revienta en la interfaz, el carro muestra un testigo rojo y un botón para reiniciar. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[CarBeat] error de interfaz:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-asphalt p-6 text-center" role="alert">
        <span className="h-14 w-14 rounded-full border-2 border-danger shadow-[0_0_24px_rgb(255_69_58/0.6)]" aria-hidden="true" />
        <h1 className="font-display text-3xl font-bold tracking-wide text-ink uppercase">Fallo en la cabina</h1>
        <p className="readout max-w-md rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-dim">{this.state.error.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl border border-cyan/45 bg-cyan/10 px-5 py-3 font-display font-semibold tracking-[0.12em] text-ice uppercase"
        >
          Reiniciar
        </button>
      </div>
    );
  }
}
