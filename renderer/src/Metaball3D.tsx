import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { fitPreviewCameraDistance } from './camera.js';
import { updateMarchingCubesField } from './field.js';
import { StudioEnvironment } from './environment.js';
import { createMaterial, materialNeedsEnvironment, type MaterialInput } from './materials.js';
import { resolveMetaballShape, type MetaballShape, type ResolvedMetaballShape } from './shape.js';
import {
  applyTriplanarTexture,
  loadTriplanarMaps,
  type TriplanarMaps,
} from './triplanar.js';

const QUALITY_RESOLUTION = { low: 56, balanced: 72, high: 96 } as const;
const CAMERA_FOV = 34;
const INITIAL_CAMERA_DISTANCE = 4.8;

export type Metaball3DQuality = keyof typeof QUALITY_RESOLUTION;

export type Metaball3DHandle = {
  canvas: HTMLCanvasElement;
  mesh: MarchingCubes;
  invalidate: () => void;
};

export type Metaball3DTexture = {
  /** Color map URL, projected triplanar (the surface has no UVs). */
  mapUrl: string;
  normalMapUrl?: string;
  roughnessMapUrl?: string;
  /** Texture repeats per world unit. */
  scale?: number;
  /** 0..1 blend over the base material. */
  amount?: number;
};

export type Metaball3DProps = {
  /** Canonical engine preset. Defaults to the current NAMCHE Loop. */
  preset?: string;
  /** Custom graph and shape controls. When supplied, it takes precedence over preset. */
  shape?: MetaballShape;
  material?: MaterialInput;
  /** Optional triplanar-projected texture layered over the material. */
  texture?: Metaball3DTexture;
  background?: THREE.ColorRepresentation;
  /**
   * Self-hosted equirectangular HDR/EXR for reflective and transmissive
   * materials. Defaults to drei's `studio` preset, loaded from a public CDN.
   */
  environmentUrl?: string;
  interactive?: boolean;
  /** Keep the render loop active for host-driven animation without rotating the camera. */
  renderContinuously?: boolean;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  quality?: Metaball3DQuality;
  dpr?: number | [number, number];
  updateDebounceMs?: number;
  preserveDrawingBuffer?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  onReady?: (handle: Metaball3DHandle) => void;
};

function CameraControls({
  objectRadius,
  interactive,
  autoRotate,
  autoRotateSpeed,
}: {
  objectRadius: number;
  interactive: boolean;
  autoRotate: boolean;
  autoRotateSpeed: number;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const minDistance = useMemo(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return 2;
    return fitPreviewCameraDistance(objectRadius, camera.fov, size.width / Math.max(1, size.height));
  }, [camera, objectRadius, size.height, size.width]);

  useLayoutEffect(() => {
    const distance = camera.position.length();
    if (distance >= minDistance || distance === 0) return;
    camera.position.multiplyScalar(minDistance / distance);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, minDistance]);

  return (
    <OrbitControls
      enablePan={false}
      enableRotate={interactive}
      enableZoom={interactive}
      autoRotate={autoRotate}
      autoRotateSpeed={autoRotateSpeed}
      minDistance={minDistance}
      maxDistance={10}
      target={[0, 0, 0]}
      makeDefault
      onChange={() => invalidate()}
    />
  );
}

function useTriplanarMaps(texture: Metaball3DTexture | undefined): TriplanarMaps | null {
  const [maps, setMaps] = useState<TriplanarMaps | null>(null);
  const { mapUrl, normalMapUrl, roughnessMapUrl } = texture ?? {};
  useEffect(() => {
    if (!mapUrl) {
      setMaps(null);
      return;
    }
    let alive = true;
    const { promise, dispose } = loadTriplanarMaps({ mapUrl, normalMapUrl, roughnessMapUrl });
    promise
      .then((loaded) => {
        if (alive) setMaps(loaded);
      })
      .catch(() => {
        // A failed texture load falls back to the untextured material.
        if (alive) setMaps(null);
      });
    return () => {
      alive = false;
      setMaps(null);
      // Dispose after the load settles so an in-flight texture is not leaked.
      promise.finally(dispose).catch(() => {});
    };
  }, [mapUrl, normalMapUrl, roughnessMapUrl]);
  return maps;
}

function MetaballMesh({
  shape,
  materialInput,
  texture,
  quality,
  updateDebounceMs,
  forwardedRef,
  onReady,
  onBoundsChange,
}: {
  shape: ResolvedMetaballShape;
  materialInput: MaterialInput;
  texture?: Metaball3DTexture;
  quality: Metaball3DQuality;
  updateDebounceMs: number;
  forwardedRef: React.ForwardedRef<Metaball3DHandle>;
  onReady?: (handle: Metaball3DHandle) => void;
  onBoundsChange: (radius: number) => void;
}) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const latestShape = useRef(shape);
  latestShape.current = shape;
  const primed = useRef(false);
  const timer = useRef<number | null>(null);
  const marchingCubes = useMemo(
    () => new MarchingCubes(QUALITY_RESOLUTION[quality], new THREE.MeshPhysicalMaterial(), false, false, 350000),
    [quality],
  );
  const triplanarMaps = useTriplanarMaps(texture);
  const materialResult = useMemo(() => {
    const result = createMaterial(materialInput);
    if (triplanarMaps) {
      applyTriplanarTexture(result.material, triplanarMaps, {
        scale: texture?.scale,
        amount: texture?.amount,
      });
    }
    return result;
  }, [materialInput, triplanarMaps, texture?.scale, texture?.amount]);

  useEffect(() => {
    marchingCubes.scale.setScalar(1.2);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      marchingCubes.geometry.dispose();
    };
  }, [marchingCubes]);

  useEffect(() => {
    marchingCubes.material = materialResult.material;
    invalidate();
    return () => materialResult.material.dispose();
  }, [invalidate, marchingCubes, materialResult]);

  const handle = useMemo<Metaball3DHandle>(
    () => ({ canvas: gl.domElement, mesh: marchingCubes, invalidate }),
    [gl.domElement, invalidate, marchingCubes],
  );
  useImperativeHandle(forwardedRef, () => handle, [handle]);
  useEffect(() => {
    onReady?.(handle);
  }, [handle, onReady]);

  useEffect(() => {
    const rebuild = () => {
      updateMarchingCubesField(marchingCubes, latestShape.current);
      const positions = marchingCubes.geometry.getAttribute('position').array as Float32Array;
      const coordinateCount = Math.min(marchingCubes.count * 3, positions.length);
      let radiusSquared = 0;
      for (let index = 0; index < coordinateCount; index += 3) {
        radiusSquared = Math.max(
          radiusSquared,
          positions[index]! ** 2 + positions[index + 1]! ** 2 + positions[index + 2]! ** 2,
        );
      }
      onBoundsChange(Math.sqrt(radiusSquared) * marchingCubes.scale.x);
      invalidate();
    };

    if (timer.current !== null) window.clearTimeout(timer.current);
    if (!primed.current || updateDebounceMs <= 0) {
      primed.current = true;
      rebuild();
      return;
    }
    timer.current = window.setTimeout(rebuild, updateDebounceMs);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [invalidate, marchingCubes, onBoundsChange, shape, updateDebounceMs]);

  return <primitive object={marchingCubes} />;
}

function Scene({
  shape,
  material,
  texture,
  background,
  environmentUrl,
  interactive,
  autoRotate,
  autoRotateSpeed,
  quality,
  updateDebounceMs,
  forwardedRef,
  onReady,
}: {
  shape: ResolvedMetaballShape;
  material: MaterialInput;
  texture?: Metaball3DTexture;
  background: THREE.ColorRepresentation;
  environmentUrl?: string;
  interactive: boolean;
  autoRotate: boolean;
  autoRotateSpeed: number;
  quality: Metaball3DQuality;
  updateDebounceMs: number;
  forwardedRef: React.ForwardedRef<Metaball3DHandle>;
  onReady?: (handle: Metaball3DHandle) => void;
}) {
  const [objectRadius, setObjectRadius] = useState(1.2);
  const needsEnvironment = materialNeedsEnvironment(material);
  const updateBounds = useCallback((radius: number) => {
    if (Number.isFinite(radius) && radius > 0) setObjectRadius(radius);
  }, []);

  return (
    <>
      <color attach="background" args={[background]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[3.2, 4.5, 5]} intensity={1.25} />
      <directionalLight position={[-3, 1.5, -2]} intensity={0.35} />
      <MetaballMesh
        shape={shape}
        materialInput={material}
        texture={texture}
        quality={quality}
        updateDebounceMs={updateDebounceMs}
        forwardedRef={forwardedRef}
        onReady={onReady}
        onBoundsChange={updateBounds}
      />
      {needsEnvironment && <StudioEnvironment url={environmentUrl} intensity={0.95} />}
      <ContactShadows position={[0, -0.78, 0]} opacity={0.32} scale={6} blur={2.2} far={2.8} resolution={256} color="#1a1a1e" />
      <CameraControls
        objectRadius={objectRadius}
        interactive={interactive}
        autoRotate={autoRotate}
        autoRotateSpeed={autoRotateSpeed}
      />
    </>
  );
}

export const Metaball3D = forwardRef<Metaball3DHandle, Metaball3DProps>(function Metaball3D(
  {
    preset,
    shape,
    material = 'wax',
    texture,
    background = '#f0f2f5',
    environmentUrl,
    interactive = true,
    renderContinuously = false,
    autoRotate = false,
    autoRotateSpeed = 1,
    quality = 'balanced',
    dpr = [1, 1.5],
    updateDebounceMs = 0,
    preserveDrawingBuffer = false,
    className,
    style,
    ariaLabel = 'Interactive 3D NAMCHE metaball',
    onReady,
  },
  forwardedRef,
) {
  const resolvedShape = useMemo(() => resolveMetaballShape(shape, preset), [preset, shape]);
  return (
    <div
      className={className}
      role="img"
      aria-label={ariaLabel}
      style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', ...style }}
    >
      <Canvas
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: interactive ? 'none' : 'auto' }}
        camera={{ position: [0, 0.25, INITIAL_CAMERA_DISTANCE], fov: CAMERA_FOV, near: 0.05, far: 50 }}
        dpr={dpr}
        frameloop={autoRotate || renderContinuously ? 'always' : 'demand'}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.12,
          powerPreference: 'high-performance',
          preserveDrawingBuffer,
        }}
      >
        <Scene
          shape={resolvedShape}
          material={material}
          texture={texture}
          background={background}
          environmentUrl={environmentUrl}
          interactive={interactive}
          autoRotate={autoRotate}
          autoRotateSpeed={autoRotateSpeed}
          quality={quality}
          updateDebounceMs={updateDebounceMs}
          forwardedRef={forwardedRef}
          onReady={onReady}
        />
      </Canvas>
    </div>
  );
});
