import { Component, type ErrorInfo, type ReactNode } from 'react';
import { setGraphicsPreference } from '../../core/device/graphics-detector';

interface Props {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary específico para escenas 3D (React Three Fiber / Three.js).
 * Si la GPU o el navegador arroja un error al crear o usar WebGL, conmuta silenciosamente
 * al componente fallback 2D y activa el modo 2D para proteger la sesión sin crashear la cabina.
 */
export class ThreeErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('[CarBeat 3D] Escena 3D no compatible o contexto WebGL perdido:', error.message, info.componentStack);
    // Registrar modo 2D para que las siguientes pantallas no intenten recrear WebGL
    setGraphicsPreference('2d');
    this.props.onError?.(error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
