/// <reference types="vite/client" />

/** 'web' en la web publicada; 'app' en el APK (lo define vite.config.ts). */
declare const __CARBEAT_TARGET__: 'web' | 'app';

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN?: string;
}
