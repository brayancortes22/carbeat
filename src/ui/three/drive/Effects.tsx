import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/*
 * Posprocesado de la portada, en su propio trozo (sólo lo descarga quien lo usa: en el celular
 * no se carga). Bloom con mipmapBlur: el brillo sale de los colores HDR (> 1) de faros, agujas,
 * ojos de gato y haces, no de todo lo que sea claro. Luego tono ACES y viñeta.
 */
export default function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.72} luminanceSmoothing={0.2} radius={0.78} levels={7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.24} darkness={0.78} />
    </EffectComposer>
  );
}
