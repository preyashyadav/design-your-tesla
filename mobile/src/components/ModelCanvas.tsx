import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber/native';
import type { MutableRefObject } from 'react';
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import {
  ACESFilmicToneMapping,
  Color,
  DataTexture,
  LinearFilter,
  Mesh,
  Object3D,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MaterialEntry } from '../types/material';
import { centerAndScaleScene, extractMaterialsFromScene } from '../utils/materials';

type ModelCanvasProps = {
  modelUri: string;
  onMaterialsExtracted: (materials: MaterialEntry[]) => void;
};

type ModelProps = ModelCanvasProps;

type OrbitState = {
  azimuth: number;
  polar: number;
  distance: number;
};

type TouchState = {
  mode: 'none' | 'rotate' | 'pinch';
  lastX: number;
  lastY: number;
  pinchStartDistance: number;
  pinchStartCameraDistance: number;
};

const MIN_DISTANCE = 1.25;
const MAX_DISTANCE = 8;
const MIN_POLAR = -1.2;
const MAX_POLAR = 1.2;

function ensureNavigatorUserAgent(): void {
  if (typeof navigator === 'undefined') {
    return;
  }

  const nav = navigator as Navigator & { userAgent?: string };
  if (typeof nav.userAgent === 'string' && nav.userAgent.length > 0) {
    return;
  }

  try {
    Object.defineProperty(nav, 'userAgent', {
      configurable: true,
      enumerable: true,
      value: 'ReactNativeExpo',
    });
  } catch {
    // Best-effort only.
  }
}

function createSolidTexture([r, g, b, a]: [number, number, number, number]): DataTexture {
  const data = new Uint8Array([r, g, b, a]);
  const texture = new DataTexture(data, 1, 1, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createVerticalGradientTexture(topHex: string, bottomHex: string): DataTexture {
  const width = 4;
  const height = 256;
  const top = new Color(topHex);
  const bottom = new Color(bottomHex);
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const t = y / (height - 1);
    const r = (top.r * (1 - t) + bottom.r * t) * 255;
    const g = (top.g * (1 - t) + bottom.g * t) * 255;
    const b = (top.b * (1 - t) + bottom.b * t) * 255;

    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createRadialGradientTexture(centerHex: string, edgeHex: string): DataTexture {
  const size = 256;
  const center = new Color(centerHex);
  const edge = new Color(edgeHex);
  const data = new Uint8Array(size * size * 4);
  const half = (size - 1) / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const distance = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const t = Math.pow(distance, 1.35);
      const r = (center.r * (1 - t) + edge.r * t) * 255;
      const g = (center.g * (1 - t) + edge.g * t) * 255;
      const b = (center.b * (1 - t) + edge.b * t) * 255;
      const idx = (y * size + x) * 4;

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function touchDistance(event: GestureResponderEvent): number | null {
  const touches = event.nativeEvent.touches;
  if (!touches || touches.length < 2) {
    return null;
  }

  const [first, second] = touches;
  if (!first || !second) {
    return null;
  }

  const dx = first.pageX - second.pageX;
  const dy = first.pageY - second.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

function OrbitCamera({ orbitRef }: { orbitRef: MutableRefObject<OrbitState> }) {
  const { camera } = useThree();

  useFrame(() => {
    const { azimuth, polar, distance } = orbitRef.current;
    const cosPolar = Math.cos(polar);
    const x = distance * Math.sin(azimuth) * cosPolar;
    const y = distance * Math.sin(polar);
    const z = distance * Math.cos(azimuth) * cosPolar;

    camera.position.set(x, y + 0.75, z);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function Model({ modelUri, onMaterialsExtracted }: ModelProps) {
  ensureNavigatorUserAgent();

  const gltf = useLoader(GLTFLoader, modelUri, (loader) => {
    loader.register(() => ({
      name: 'ExpoTextureFallback',
      loadTexture: async () => {
        const texture = createSolidTexture([228, 232, 239, 255]);
        texture.flipY = false;
        texture.needsUpdate = true;
        return texture;
      },
    }));
  }) as GLTF;

  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);

    cloned.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) {
        return;
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });

    centerAndScaleScene(cloned);
    return cloned;
  }, [gltf.scene]);

  useEffect(() => {
    onMaterialsExtracted(extractMaterialsFromScene(scene));
  }, [onMaterialsExtracted, scene]);

  return <primitive object={scene} />;
}

function ShowroomEnvironment() {
  const backdropTexture = useMemo(() => createVerticalGradientTexture('#F8FAFD', '#D8E0EA'), []);
  const floorTexture = useMemo(() => createRadialGradientTexture('#F4F6FA', '#C7D1DD'), []);

  useEffect(() => {
    return () => {
      backdropTexture.dispose();
      floorTexture.dispose();
    };
  }, [backdropTexture, floorTexture]);

  return (
    <>
      <hemisphereLight args={['#FFFFFF', '#BFC8D4', 0.72]} />
      <spotLight
        angle={0.48}
        castShadow
        intensity={2.25}
        penumbra={0.85}
        position={[6, 8, 4]}
        shadow-bias={-0.0001}
        shadow-mapSize-height={1024}
        shadow-mapSize-width={1024}
      />
      <spotLight angle={0.58} intensity={1.1} penumbra={1} position={[-5, 5, 2]} />
      <spotLight angle={0.62} intensity={0.65} penumbra={1} position={[0, 5, -6]} />

      <mesh position={[0, 1.45, -7.6]}>
        <planeGeometry args={[18, 11]} />
        <meshBasicMaterial map={backdropTexture} toneMapped={false} />
      </mesh>

      <mesh position={[0, -1.1, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[6, 96]} />
        <meshStandardMaterial map={floorTexture} metalness={0.08} roughness={0.7} />
      </mesh>
    </>
  );
}

export function ModelCanvas({ modelUri, onMaterialsExtracted }: ModelCanvasProps) {
  const orbitRef = useRef<OrbitState>({
    azimuth: 0,
    polar: 0.1,
    distance: 4.2,
  });

  const touchRef = useRef<TouchState>({
    mode: 'none',
    lastX: 0,
    lastY: 0,
    pinchStartDistance: 0,
    pinchStartCameraDistance: 4.2,
  });

  const handleResponderGrant = useCallback((event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;

    if (touches.length >= 2) {
      const distance = touchDistance(event);
      if (!distance) {
        return;
      }
      touchRef.current = {
        mode: 'pinch',
        lastX: 0,
        lastY: 0,
        pinchStartDistance: distance,
        pinchStartCameraDistance: orbitRef.current.distance,
      };
      return;
    }

    if (touches.length === 1) {
      const [touch] = touches;
      touchRef.current.mode = 'rotate';
      touchRef.current.lastX = touch.pageX;
      touchRef.current.lastY = touch.pageY;
    }
  }, []);

  const handleResponderMove = useCallback((event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;

    if (touches.length >= 2) {
      const distance = touchDistance(event);
      if (!distance) {
        return;
      }

      if (touchRef.current.mode !== 'pinch') {
        touchRef.current.mode = 'pinch';
        touchRef.current.pinchStartDistance = distance;
        touchRef.current.pinchStartCameraDistance = orbitRef.current.distance;
        return;
      }

      const scale = touchRef.current.pinchStartDistance / distance;
      orbitRef.current.distance = clamp(
        touchRef.current.pinchStartCameraDistance * scale,
        MIN_DISTANCE,
        MAX_DISTANCE,
      );
      return;
    }

    if (touches.length === 1) {
      const [touch] = touches;

      if (touchRef.current.mode !== 'rotate') {
        touchRef.current.mode = 'rotate';
        touchRef.current.lastX = touch.pageX;
        touchRef.current.lastY = touch.pageY;
        return;
      }

      const dx = touch.pageX - touchRef.current.lastX;
      const dy = touch.pageY - touchRef.current.lastY;

      orbitRef.current.azimuth -= dx * 0.01;
      orbitRef.current.polar = clamp(orbitRef.current.polar + dy * 0.01, MIN_POLAR, MAX_POLAR);
      touchRef.current.lastX = touch.pageX;
      touchRef.current.lastY = touch.pageY;
      return;
    }

    touchRef.current.mode = 'none';
  }, []);

  const handleResponderEnd = useCallback(() => {
    touchRef.current.mode = 'none';
    touchRef.current.pinchStartDistance = 0;
  }, []);

  return (
    <View style={styles.container}>
      <Canvas
        camera={{ fov: 45, position: [0, 1.25, 4.2] }}
        gl={{ antialias: false }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.shadowMap.enabled = true;
          (gl as { outputColorSpace?: string }).outputColorSpace = SRGBColorSpace;
        }}
        shadows
      >
        <ShowroomEnvironment />
        <Suspense fallback={null}>
          <Model modelUri={modelUri} onMaterialsExtracted={onMaterialsExtracted} />
        </Suspense>
        <OrbitCamera orbitRef={orbitRef} />
      </Canvas>
      <View
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleResponderGrant}
        onResponderMove={handleResponderMove}
        onResponderRelease={handleResponderEnd}
        onResponderTerminate={handleResponderEnd}
        onStartShouldSetResponder={() => true}
        style={styles.touchOverlay}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    flex: 1,
    overflow: 'hidden',
  },
  touchOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
