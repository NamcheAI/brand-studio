import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Caustics,
  ContactShadows,
  Environment,
  MeshTransmissionMaterial,
  OrbitControls,
} from '@react-three/drei';
import { Bloom, ChromaticAberration, EffectComposer } from '@react-three/postprocessing';
import {
  Metaball3D,
  type Metaball3DHandle,
} from '@namche/metaball-react';
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import {
  getLiveMarchingCubes,
  setLiveMarchingCubes,
  type Canvas3DHandle,
} from '../lib/canvas3dHandle';
import { MC_RESOLUTION, toMetaball3DShape, updateMarchingCubesField } from '../lib/metaball3d';
import { fitPreviewCameraDistance } from '../lib/camera3d';
import { getMaterialPreset } from '../lib/materialPresets';
import { textureForSlug } from '../lib/texturePresets';
import { createMaterialForPreset } from '../lib/organicMaterials';
import {
  liquidAttenuationDistance,
  liquidSurfaceColor,
  type CausticDance,
  type LiquidParams,
} from '../lib/liquidPresets';
import { getLiquidBackdrop, type LiquidBackdrop } from '../lib/liquidBackdrops';
import { SURFACE_SAMPLER_COUNT_MAX, type Document } from '../lib/model';
import { sampleMarchingCubesSurface, type SurfaceSample } from '../lib/surfaceSampler';

type Props = {
  doc: Document;
  // Handle onto the live isosurface mesh for GLB export.
  meshRef?: MutableRefObject<MarchingCubes | null>;
  // WebGL canvas + invalidate for Blender handoff preview snapshot.
  canvasHandleRef?: MutableRefObject<Canvas3DHandle | null>;
  /** Set to 0 for immediate rebuilds during already-throttled playback. */
  fieldDebounceMs?: number;
  /** Keep rendering every frame (Prism postfx / Drift animation). */
  continuous?: boolean;
};

const FIELD_DEBOUNCE_MS = 48;

const POINTS_COLOR = 0xe84d9b;
const SPHERES_COLOR = 0xffa0e6;

/** Duration for progressive surface reveal (Codrops-style), scaled by count. */
function revealDurationMs(count: number): number {
  return Math.min(4200, Math.max(900, count * 0.75));
}

const CAMERA_FOV = 34;
const INITIAL_CAMERA_DISTANCE = 4.8;
const MAX_CAMERA_DISTANCE = 10;

function InvalidateOnControl({ objectRadius }: { objectRadius: number }) {
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const minDistance = useMemo(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return 2;
    return fitPreviewCameraDistance(
      objectRadius,
      camera.fov,
      size.width / Math.max(1, size.height),
    );
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
      minDistance={minDistance}
      maxDistance={MAX_CAMERA_DISTANCE}
      target={[0, 0, 0]}
      makeDefault
      onChange={() => invalidate()}
    />
  );
}

function PublishHandles({
  mc,
  meshRef,
  canvasHandleRef,
}: {
  mc: MarchingCubes;
  meshRef?: MutableRefObject<MarchingCubes | null>;
  canvasHandleRef?: MutableRefObject<Canvas3DHandle | null>;
}) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  useLayoutEffect(() => {
    setLiveMarchingCubes(mc);
    if (meshRef) meshRef.current = mc;
    if (canvasHandleRef) {
      canvasHandleRef.current = {
        canvas: gl.domElement,
        invalidate,
        mesh: mc,
      };
    }
    return () => {
      setLiveMarchingCubes(null);
      if (meshRef && meshRef.current === mc) meshRef.current = null;
      if (canvasHandleRef?.current?.mesh === mc) {
        canvasHandleRef.current = {
          canvas: gl.domElement,
          invalidate,
          mesh: null,
        };
      }
    };
  }, [mc, meshRef, canvasHandleRef, gl, invalidate]);

  return null;
}

/** Deterministic scale jitter so instances don't reshuffle on size-only updates. */
function instanceScaleJitter(index: number): number {
  const hash = Math.imul(index ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  return 0.5 + ((hash % 1000) / 1000) * 0.5;
}

function MetaballMesh({
  doc,
  meshRef,
  canvasHandleRef,
  fieldDebounceMs = FIELD_DEBOUNCE_MS,
  onBoundsChange,
}: Props & { onBoundsChange: (radius: number) => void }) {
  const invalidate = useThree((s) => s.invalidate);
  const debounceRef = useRef<number | null>(null);
  const primed = useRef(false);
  const latestDoc = useRef(doc);
  latestDoc.current = doc;
  const lastSampleRef = useRef<SurfaceSample | null>(null);
  const revealedRef = useRef(0);
  const animRafRef = useRef<number | null>(null);
  const prevAnimateRef = useRef(doc.surfaceSamplerAnimate);
  const prevEnabledRef = useRef(doc.surfaceSamplerEnabled);
  const tempObject = useMemo(() => new THREE.Object3D(), []);

  const mc = useMemo(
    () => new MarchingCubes(MC_RESOLUTION, new THREE.MeshPhysicalMaterial(), false, false, 350000),
    [],
  );

  const points = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    const mat = new THREE.PointsMaterial({
      color: POINTS_COLOR,
      size: 0.04,
      sizeAttenuation: true,
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
    });
    const pts = new THREE.Points(geo, mat);
    pts.visible = false;
    pts.frustumCulled = false;
    pts.renderOrder = 2;
    return pts;
  }, []);

  const spheres = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 8, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: SPHERES_COLOR,
      emissive: SPHERES_COLOR,
      emissiveIntensity: 0.35,
      roughness: 0.45,
      metalness: 0,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, SURFACE_SAMPLER_COUNT_MAX);
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.renderOrder = 2;
    return mesh;
  }, []);

  useEffect(() => {
    mc.scale.setScalar(1.2);
  }, [mc]);

  useEffect(
    () => () => {
      if (animRafRef.current !== null) window.cancelAnimationFrame(animRafRef.current);
      mc.geometry.dispose();
      points.geometry.dispose();
      (points.material as THREE.Material).dispose();
      spheres.geometry.dispose();
      (spheres.material as THREE.Material).dispose();
      spheres.dispose();
    },
    [mc, points, spheres],
  );

  const isLiquid = doc.lookMode === 'liquid';
  const material = useMemo(() => {
    // Liquid live view uses MeshTransmissionMaterial (attached in JSX).
    if (isLiquid) return null;
    return createMaterialForPreset(doc.materialPreset);
  }, [isLiquid, doc.materialPreset]);

  useEffect(() => {
    if (!material) return;
    mc.material = material;
    invalidate();
    return () => material.dispose();
  }, [mc, material, invalidate]);

  const stopRevealAnimation = () => {
    if (animRafRef.current !== null) {
      window.cancelAnimationFrame(animRafRef.current);
      animRafRef.current = null;
    }
  };

  const applyRevealCount = (revealed: number, d: Document) => {
    const sample = lastSampleRef.current;
    const enabled = d.surfaceSamplerEnabled;
    const showPoints =
      enabled && (d.surfaceSamplerMode === 'points' || d.surfaceSamplerMode === 'both');
    const showSpheres =
      enabled && (d.surfaceSamplerMode === 'spheres' || d.surfaceSamplerMode === 'both');

    mc.visible = !enabled || d.surfaceSamplerShowMesh;

    const pointsMat = points.material as THREE.PointsMaterial;
    pointsMat.size = d.surfaceSamplerPointSize;

    if (!sample || !enabled) {
      points.visible = false;
      points.geometry.setDrawRange(0, 0);
      spheres.visible = false;
      spheres.count = 0;
      revealedRef.current = 0;
      return;
    }

    const total = Math.min(sample.count, SURFACE_SAMPLER_COUNT_MAX);
    const n = Math.max(0, Math.min(revealed, total));
    revealedRef.current = n;

    points.geometry.setDrawRange(0, n);
    points.visible = showPoints && n > 0;

    // Matrices are preloaded in loadSampleBuffers; only the visible count grows.
    spheres.count = n;
    spheres.visible = showSpheres && n > 0;
  };

  const loadSampleBuffers = (sample: SurfaceSample, d: Document) => {
    const n = Math.min(sample.count, SURFACE_SAMPLER_COUNT_MAX);
    points.geometry.setAttribute('position', new THREE.BufferAttribute(sample.positions, 3));
    points.geometry.computeBoundingSphere();

    const baseSize = d.surfaceSamplerSphereSize;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      tempObject.position.set(
        sample.positions[o]!,
        sample.positions[o + 1]!,
        sample.positions[o + 2]!,
      );
      tempObject.scale.setScalar(baseSize * instanceScaleJitter(i));
      tempObject.updateMatrix();
      spheres.setMatrixAt(i, tempObject.matrix);
    }
    spheres.instanceMatrix.needsUpdate = true;
    spheres.computeBoundingSphere();
  };

  const startRevealAnimation = (total: number, d: Document) => {
    stopRevealAnimation();
    if (total <= 0) {
      applyRevealCount(0, d);
      return;
    }
    if (!d.surfaceSamplerAnimate) {
      applyRevealCount(total, d);
      return;
    }

    applyRevealCount(0, d);
    const start = performance.now();
    const duration = revealDurationMs(total);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t);
      const revealed = Math.floor(eased * total);
      applyRevealCount(revealed, latestDoc.current);
      invalidate();
      if (t < 1) {
        animRafRef.current = window.requestAnimationFrame(tick);
      } else {
        animRafRef.current = null;
        applyRevealCount(total, latestDoc.current);
        invalidate();
      }
    };
    animRafRef.current = window.requestAnimationFrame(tick);
  };

  const applyOverlays = (
    sample: SurfaceSample | null,
    d: Document,
    opts: { animate: boolean } = { animate: true },
  ) => {
    stopRevealAnimation();
    const enabled = d.surfaceSamplerEnabled;

    if (!sample || !enabled) {
      lastSampleRef.current = sample;
      applyRevealCount(0, d);
      return;
    }

    lastSampleRef.current = sample;
    loadSampleBuffers(sample, d);
    const total = Math.min(sample.count, SURFACE_SAMPLER_COUNT_MAX);
    if (opts.animate && d.surfaceSamplerAnimate) {
      startRevealAnimation(total, d);
    } else {
      applyRevealCount(total, d);
    }
  };

  const resampleFromMesh = (animate = true) => {
    const d = latestDoc.current;
    if (!d.surfaceSamplerEnabled || mc.count === 0) {
      lastSampleRef.current = null;
      applyOverlays(null, d, { animate: false });
      return;
    }
    const sample = sampleMarchingCubesSurface(mc, d.surfaceSamplerCount);
    applyOverlays(sample, d, { animate });
  };

  useEffect(() => {
    const rebuild = () => {
      updateMarchingCubesField(mc, latestDoc.current);
      const positions = mc.geometry.getAttribute('position').array as Float32Array;
      const coordinateCount = Math.min(mc.count * 3, positions.length);
      let radiusSquared = 0;
      for (let i = 0; i < coordinateCount; i += 3) {
        radiusSquared = Math.max(
          radiusSquared,
          positions[i]! * positions[i]! +
            positions[i + 1]! * positions[i + 1]! +
            positions[i + 2]! * positions[i + 2]!,
        );
      }
      onBoundsChange(Math.sqrt(radiusSquared) * Math.max(mc.scale.x, mc.scale.y, mc.scale.z));
      resampleFromMesh();
      invalidate();
    };

    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);

    if (!primed.current || fieldDebounceMs <= 0) {
      primed.current = true;
      rebuild();
      return;
    }

    debounceRef.current = window.setTimeout(rebuild, fieldDebounceMs);
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
    // resampleFromMesh closes over mc/points/spheres via refs — intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- field deps only
  }, [
    mc,
    invalidate,
    onBoundsChange,
    fieldDebounceMs,
    doc.nodes,
    doc.edges,
    doc.edgeFactors,
    doc.edgePulls,
    doc.tubeFactor,
    doc.inwardPull,
    doc.gooStd,
    doc.gooThreshold,
  ]);

  // Sampler settings: re-sample when count/enabled change; re-apply for size/mode/mesh.
  useEffect(() => {
    const d = doc;
    const prev = lastSampleRef.current;
    const animateJustOn = d.surfaceSamplerAnimate && !prevAnimateRef.current;
    const enabledJustOn = d.surfaceSamplerEnabled && !prevEnabledRef.current;
    prevAnimateRef.current = d.surfaceSamplerAnimate;
    prevEnabledRef.current = d.surfaceSamplerEnabled;

    const needsResample =
      d.surfaceSamplerEnabled &&
      mc.count > 0 &&
      (enabledJustOn || !prev || prev.count !== d.surfaceSamplerCount);

    if (needsResample) {
      resampleFromMesh(true);
    } else if (!d.surfaceSamplerEnabled) {
      lastSampleRef.current = null;
      applyOverlays(null, d, { animate: false });
    } else if (prev) {
      const total = Math.min(prev.count, SURFACE_SAMPLER_COUNT_MAX);
      loadSampleBuffers(prev, d);
      if (!d.surfaceSamplerAnimate) {
        stopRevealAnimation();
        applyRevealCount(total, d);
      } else if (animateJustOn) {
        startRevealAnimation(total, d);
      } else if (animRafRef.current !== null) {
        // Reveal in progress — only refresh matrices/sizes; don't jump the count.
        applyRevealCount(revealedRef.current, d);
      } else {
        applyRevealCount(revealedRef.current > 0 ? revealedRef.current : total, d);
      }
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    doc.surfaceSamplerEnabled,
    doc.surfaceSamplerMode,
    doc.surfaceSamplerCount,
    doc.surfaceSamplerPointSize,
    doc.surfaceSamplerSphereSize,
    doc.surfaceSamplerShowMesh,
    doc.surfaceSamplerAnimate,
    invalidate,
    mc,
  ]);

  const lp = doc.liquidParams;
  const causticStrength = lp.causticStrength ?? 0;
  const waveStrength = lp.waveStrength ?? 0;
  const dance: CausticDance = lp.causticDance ?? 'lively';
  const danceMul = dance === 'wild' ? 1.55 : dance === 'calm' ? 0.55 : 1;
  const showCaustics = isLiquid && lp.transmission >= 0.35 && causticStrength > 0.02;
  const lightRef = useRef(new THREE.Object3D());
  const wobbleRef = useRef<THREE.Group>(null);
  const mtmRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const baseDistort = 0.16 + lp.dispersion * 0.3 + causticStrength * 0.14 + waveStrength * 0.28;
  const baseTemporal = 0.28 + causticStrength * 0.35 + waveStrength * 0.45;
  const baseThickness = 1.05 + lp.transmission * 0.55 + lp.opacity * 0.35;
  const baseChroma = 0.045 + lp.dispersion * 0.2 + lp.rimStrength * 0.07;

  useFrame(({ clock }) => {
    if (!isLiquid) return;
    const t = clock.elapsedTime;
    const amp = (0.55 + causticStrength * 1.1) * (0.7 + danceMul * 0.35);
    const a = t * (0.45 + causticStrength * 0.55) * danceMul;
    const b = t * (0.22 + causticStrength * 0.28) * danceMul;
    const heightPulse =
      5.2 +
      Math.sin(a * 0.85) * (1 + causticStrength * 1.2) * danceMul +
      Math.sin(t * (1.4 + danceMul)) * 0.35 * danceMul;
    lightRef.current.position.set(
      Math.cos(a) * (3.8 + amp) + Math.sin(b) * 1.4,
      heightPulse,
      Math.sin(a) * (3.2 + amp * 0.7) + Math.cos(b * 1.3) * 1.1,
    );
    if (wobbleRef.current) {
      const w = 0.04 + causticStrength * 0.06 + waveStrength * 0.05;
      const w1 = Math.sin(t * (0.7 + waveStrength * 0.8));
      const w2 = Math.sin(t * (1.3 + waveStrength * 1.4));
      const w3 = Math.sin(t * (2.1 + waveStrength * 0.6) + 0.8);
      wobbleRef.current.rotation.y = w1 * w + w2 * w * 0.35;
      wobbleRef.current.rotation.x = Math.cos(t * 0.55) * w * 0.7 + w3 * w * 0.2 * waveStrength;
      wobbleRef.current.rotation.z = Math.sin(t * 0.35) * w * 0.25;
      wobbleRef.current.position.y =
        Math.sin(t * 1.1) * 0.018 * (0.6 + causticStrength) +
        Math.sin(t * 2.4) * 0.01 * waveStrength;
      const s =
        1 +
        Math.sin(t * 0.9) * 0.012 * (0.5 + causticStrength) +
        Math.sin(t * 1.7 + 0.4) * 0.01 * waveStrength +
        Math.sin(t * 3.1) * 0.006 * waveStrength;
      wobbleRef.current.scale.setScalar(s);
    }
    // Internal “water motion”: drive transmission shader so refraction/caustics keep shifting.
    const mat = mtmRef.current as
      | (THREE.MeshPhysicalMaterial & {
          distortion?: number;
          temporalDistortion?: number;
          chromaticAberration?: number;
        })
      | null;
    if (mat) {
      const surge =
        0.55 +
        0.45 * Math.sin(t * (1.15 + waveStrength * 0.9)) +
        0.2 * waveStrength * Math.sin(t * 2.6);
      const surge2 =
        0.55 +
        0.45 * Math.sin(t * (0.62 + waveStrength * 0.5) + 1.7) +
        0.18 * waveStrength * Math.sin(t * 1.9 + 0.3);
      const intensityPulse =
        dance === 'wild'
          ? 0.75 + 0.45 * Math.sin(t * 2.2)
          : dance === 'calm'
            ? 0.92 + 0.08 * Math.sin(t * 0.5)
            : 0.85 + 0.2 * Math.sin(t * 1.1);
      if (typeof mat.distortion === 'number') {
        mat.distortion = baseDistort * (0.75 + 0.55 * surge) * intensityPulse;
      }
      if (typeof mat.temporalDistortion === 'number') {
        mat.temporalDistortion = baseTemporal * (0.85 + 0.4 * surge2) * intensityPulse;
      }
      if (typeof mat.chromaticAberration === 'number') {
        mat.chromaticAberration = baseChroma * (0.8 + 0.35 * Math.sin(t * 0.95 + 0.4));
      }
      mat.thickness = baseThickness * (0.92 + 0.16 * Math.sin(t * 0.75));
    }
  });

  const mtm = isLiquid ? (
    <MeshTransmissionMaterial
      ref={mtmRef as never}
      attach="material"
      samples={6}
      resolution={320}
      transmission={lp.transmission}
      roughness={lp.roughness}
      thickness={baseThickness}
      ior={lp.ior}
      chromaticAberration={baseChroma}
      anisotropy={0.12}
      anisotropicBlur={0.4}
      distortion={baseDistort}
      distortionScale={0.28}
      temporalDistortion={baseTemporal}
      color={liquidSurfaceColor(lp.tint)}
      attenuationColor={lp.tint}
      attenuationDistance={liquidAttenuationDistance(lp)}
      clearcoat={0.35 + (1 - lp.roughness) * 0.25}
      clearcoatRoughness={Math.min(1, lp.roughness * 0.65 + 0.08)}
      toneMapped
    />
  ) : null;

  const meshPrimitive = (
    <group ref={wobbleRef}>
      <primitive object={mc}>{mtm}</primitive>
    </group>
  );

  return (
    <>
      <PublishHandles mc={mc} meshRef={meshRef} canvasHandleRef={canvasHandleRef} />
      {showCaustics ? (
        <>
          <primitive object={lightRef.current} />
          <Caustics
            frames={Infinity}
            backside
            causticsOnly={false}
            color="#ffe8d4"
            ior={lp.ior}
            backsideIOR={Math.max(1.05, lp.ior - 0.08)}
            worldRadius={0.1 + (1 - causticStrength) * 0.1 + lp.bloom * 0.04}
            intensity={
              (0.04 + causticStrength * 0.12 + lp.transmission * 0.04 + lp.bloom * 0.03) *
              (0.7 + danceMul * 0.25)
            }
            resolution={512}
            lightSource={lightRef}
            position={[0, -0.78, 0]}
          >
            <group position={[0, 0.78, 0]}>{meshPrimitive}</group>
          </Caustics>
        </>
      ) : (
        meshPrimitive
      )}
      <primitive object={points} />
      <primitive object={spheres} />
    </>
  );
}

function KickFrames({ times = 3 }: { times?: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let left = times;
    let id = 0;
    const tick = () => {
      invalidate();
      left -= 1;
      if (left > 0) id = window.requestAnimationFrame(tick);
    };
    id = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(id);
  }, [invalidate, times]);
  return null;
}

function RefractionFloor({ backdrop }: { backdrop: LiquidBackdrop | null }) {
  const gridTex = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const bg = backdrop?.sceneBg ?? '#ececf0';
    const a = backdrop?.theme.pink ?? '#e4e6ea';
    const b = backdrop?.theme.blue ?? '#d9dce2';
    const pattern = backdrop?.pattern ?? 'cells';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    const step = pattern === 'stripes' ? 24 : 32;
    if (pattern === 'checker') {
      for (let y = 0; y < size; y += step) {
        for (let x = 0; x < size; x += step) {
          const odd = ((x / step) | 0) + ((y / step) | 0);
          ctx.fillStyle = odd % 2 === 0 ? a : b;
          ctx.fillRect(x, y, step, step);
        }
      }
    } else if (pattern === 'stripes') {
      for (let x = 0; x < size; x += step) {
        ctx.fillStyle = ((x / step) | 0) % 2 === 0 ? a : b;
        ctx.fillRect(x, 0, step, size);
      }
    } else {
      ctx.strokeStyle = backdrop ? `${backdrop.theme.ink}44` : 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= size; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();
      }
      // Subtle cell tint bands
      for (let y = 0; y < size; y += step * 2) {
        for (let x = 0; x < size; x += step * 2) {
          ctx.fillStyle = `${a}55`;
          ctx.fillRect(x, y, step, step);
          ctx.fillStyle = `${b}55`;
          ctx.fillRect(x + step, y + step, step, step);
        }
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(pattern === 'stripes' ? 3 : 4, pattern === 'stripes' ? 3 : 4);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [backdrop]);

  useEffect(() => () => gridTex.dispose(), [gridTex]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.79, 0]} receiveShadow>
      <planeGeometry args={[8, 8]} />
      <meshStandardMaterial map={gridTex} color="#ffffff" roughness={0.92} metalness={0} />
    </mesh>
  );
}

/** Soft wet ellipse + short trail under the liquid blob (app-only). */
function WetMapDecal({ liquidParams }: { liquidParams: LiquidParams }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<{ x: number; z: number; a: number }[]>([]);
  const updateElapsedRef = useRef(0);
  const boxRef = useRef(new THREE.Box3());
  const centerRef = useRef(new THREE.Vector3());
  const { canvas, tex } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return { canvas, tex };
  }, []);

  useEffect(() => () => tex.dispose(), [tex]);

  useFrame((_, dt) => {
    updateElapsedRef.current += dt;
    if (updateElapsedRef.current < 1 / 30) return;
    const elapsed = updateElapsedRef.current;
    updateElapsedRef.current = 0;

    const mc = getLiveMarchingCubes();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let wx = 0;
    let wz = 0;
    if (mc) {
      const box = boxRef.current.setFromObject(mc);
      if (!box.isEmpty()) {
        const c = box.getCenter(centerRef.current);
        wx = c.x;
        wz = c.z;
      } else {
        wx = mc.position.x;
        wz = mc.position.z;
      }
    }

    const trail = trailRef.current;
    trail.push({ x: wx, z: wz, a: 1 });
    const fade = Math.max(0.82, 1 - elapsed * 2.4);
    for (const p of trail) p.a *= fade;
    while (trail.length > 18 || (trail[0] && trail[0].a < 0.04)) trail.shift();

    const opacity = Math.min(
      0.55,
      0.12 + liquidParams.transmission * 0.28 + liquidParams.causticStrength * 0.22,
    );

    ctx.clearRect(0, 0, 256, 256);
    const worldToUv = (x: number, z: number) => ({
      u: ((x + 4) / 8) * 256,
      v: ((z + 4) / 8) * 256,
    });

    for (const p of trail) {
      const { u, v } = worldToUv(p.x, p.z);
      const r = 28 + liquidParams.causticStrength * 18;
      const g = ctx.createRadialGradient(u, v, 2, u, v, r);
      g.addColorStop(0, `rgba(120, 160, 200, ${opacity * p.a})`);
      g.addColorStop(0.45, `rgba(140, 175, 210, ${opacity * 0.45 * p.a})`);
      g.addColorStop(1, 'rgba(160, 190, 220, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(u, v, r * 1.15, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    tex.needsUpdate = true;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.775, 0]} renderOrder={2}>
      <planeGeometry args={[8, 8]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} opacity={0.55} toneMapped />
    </mesh>
  );
}

function SceneLights({ liquid }: { liquid?: boolean }) {
  return (
    <>
      <ambientLight intensity={liquid ? 0.28 : 0.45} />
      <directionalLight position={[3.2, 4.5, 5]} intensity={liquid ? 0.72 : 1.25} />
      <directionalLight position={[-3, 1.5, -2]} intensity={liquid ? 0.22 : 0.35} />
      {liquid && <directionalLight position={[0.5, 6, -2]} intensity={0.18} color="#dce9ff" />}
    </>
  );
}

function PrismPostFx({
  bloom,
  rim,
  dispersion,
}: {
  bloom: number;
  rim: number;
  dispersion: number;
}) {
  const offset = useMemo(
    () =>
      new THREE.Vector2(
        0.0012 + rim * 0.0022 + dispersion * 0.0012,
        0.0009 + rim * 0.0016 + dispersion * 0.0008,
      ),
    [rim, dispersion],
  );
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.08 + bloom * 0.32 + rim * 0.06}
        luminanceThreshold={Math.max(0.42, 0.62 - bloom * 0.12)}
        luminanceSmoothing={0.55}
        mipmapBlur
      />
      {rim > 0.05 && <ChromaticAberration offset={offset} />}
    </EffectComposer>
  );
}

function Scene({ doc, meshRef, canvasHandleRef, fieldDebounceMs }: Props) {
  const [objectRadius, setObjectRadius] = useState(1.2);
  const handleBoundsChange = useCallback((radius: number) => {
    if (!Number.isFinite(radius) || radius <= 0) return;
    setObjectRadius((current) => (Math.abs(current - radius) < 0.01 ? current : radius));
  }, []);
  const preset = getMaterialPreset(doc.materialPreset);
  const isLiquid = doc.lookMode === 'liquid';
  const backdrop = isLiquid ? getLiquidBackdrop(doc.liquidBackdrop) : null;
  const showEnv = isLiquid || Boolean(preset.needsEnvironment);
  const useTransmissionLook =
    isLiquid ||
    (typeof preset.params.transmission === 'number' && preset.params.transmission > 0.35);

  return (
    <>
      <color attach="background" args={[backdrop?.sceneBg ?? '#ececf0']} />
      <SceneLights liquid={isLiquid} />
      {useTransmissionLook && <RefractionFloor backdrop={backdrop} />}
      {isLiquid && <WetMapDecal liquidParams={doc.liquidParams} />}
      {/* Keep mesh outside Suspense — Environment suspend must not clear mesh handles. */}
      <MetaballMesh
        doc={doc}
        meshRef={meshRef}
        canvasHandleRef={canvasHandleRef}
        fieldDebounceMs={fieldDebounceMs}
        onBoundsChange={handleBoundsChange}
      />
      <Suspense fallback={null}>
        {showEnv && (
          <Environment
            preset="studio"
            environmentIntensity={isLiquid ? 0.28 + doc.liquidParams.transmission * 0.22 : 0.95}
          />
        )}
      </Suspense>
      <ContactShadows
        position={[0, -0.78, 0]}
        opacity={isLiquid ? 0.1 + (1 - doc.liquidParams.transmission) * 0.14 : 0.32}
        scale={6}
        blur={isLiquid ? 3.4 : 2.2}
        far={2.8}
        resolution={256}
        color="#1a1a1e"
      />
      {isLiquid && (
        <PrismPostFx
          bloom={doc.liquidParams.bloom}
          rim={doc.liquidParams.rimStrength}
          dispersion={doc.liquidParams.dispersion}
        />
      )}
      <KickFrames
        key={`${doc.lookMode}-${doc.materialPreset}-${doc.liquidPreset}-${doc.liquidBackdrop}`}
        times={isLiquid ? 12 : 6}
      />
      <InvalidateOnControl objectRadius={objectRadius} />
    </>
  );
}

/** Thin Studio adapter around the public viewer for the normal material path. */
function PublicMaterialPreview({
  doc,
  meshRef,
  canvasHandleRef,
  fieldDebounceMs = FIELD_DEBOUNCE_MS,
  continuous = false,
}: Props) {
  const publishHandle = useCallback(
    (handle: Metaball3DHandle | null) => {
      if (meshRef) meshRef.current = handle?.mesh ?? null;
      if (canvasHandleRef) {
        canvasHandleRef.current = handle
          ? { canvas: handle.canvas, mesh: handle.mesh, invalidate: handle.invalidate }
          : null;
      }
    },
    [canvasHandleRef, meshRef],
  );

  const shape = useMemo(() => toMetaball3DShape(doc), [doc]);
  return (
    <Metaball3D
      ref={publishHandle}
      className="metaball-3d-canvas"
      style={{ width: '100%', height: '100%', aspectRatio: 'auto' }}
      shape={shape}
      material={getMaterialPreset(doc.materialPreset).id}
      texture={textureForSlug(doc.textureSlug, doc.textureScale, doc.textureAmount)}
      background="#ececf0"
      quality="high"
      renderContinuously={continuous}
      updateDebounceMs={fieldDebounceMs}
      preserveDrawingBuffer
    />
  );
}

export default function Metaball3DPreview({
  doc,
  meshRef,
  canvasHandleRef,
  fieldDebounceMs,
  continuous = false,
}: Props) {
  const fallbackRef = useRef<MarchingCubes | null>(null);
  const isLiquid = doc.lookMode === 'liquid';

  useEffect(() => {
    return () => {
      setLiveMarchingCubes(null);
      if (canvasHandleRef) canvasHandleRef.current = null;
    };
  }, [canvasHandleRef]);

  if (!isLiquid && !doc.surfaceSamplerEnabled) {
    return (
      <PublicMaterialPreview
        doc={doc}
        meshRef={meshRef ?? fallbackRef}
        canvasHandleRef={canvasHandleRef}
        fieldDebounceMs={fieldDebounceMs}
        continuous={continuous}
      />
    );
  }

  return (
    <Canvas
      className="metaball-3d-canvas"
      style={{ width: '100%', height: '100%' }}
      camera={{ position: [0, 0.25, INITIAL_CAMERA_DISTANCE], fov: CAMERA_FOV, near: 0.05, far: 50 }}
      dpr={[1, 1.5]}
      frameloop={continuous || isLiquid ? 'always' : 'demand'}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: isLiquid ? 0.78 : 1.12,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      }}
      onCreated={({ gl, invalidate }) => {
        if (canvasHandleRef) {
          canvasHandleRef.current = {
            canvas: gl.domElement,
            invalidate,
            mesh: canvasHandleRef.current?.mesh ?? null,
          };
        }
      }}
    >
      <Scene
        doc={doc}
        meshRef={meshRef ?? fallbackRef}
        canvasHandleRef={canvasHandleRef}
        fieldDebounceMs={fieldDebounceMs}
      />
    </Canvas>
  );
}
