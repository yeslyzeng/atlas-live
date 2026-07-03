import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { motion, useMotionValue, animate } from 'motion/react';
import { useResizeObserver } from 'usehooks-ts';
import { VirtualGrid } from './grid/VirtualGrid';
import { useDragScroll } from './grid/useDragScroll';
import { mod, boundaryOp, getShortestConnection } from './grid/math';
import type { Resource } from '../types';
import * as THREE from 'three';

interface GridViewProps {
  resources: Resource[];
  onSelectResource: (r: Resource) => void;
  isDarkMode?: boolean;
}

type DemoStep = 'carousel' | 'infinite-row' | 'grid' | 'torus';

/**
 * GridView — Full interactive demonstration of Seth Thompson's
 * "Infinite Image Grids are Flat Toruses" article.
 *
 * Steps through the entire reasoning process:
 * 1. Simple carousel (single image, modulo index)
 * 2. Infinite row (VirtualRow with periodic boundary, drag+momentum)
 * 3. Infinite grid (VirtualGrid, 2D periodic space, goTo shortest path)
 * 4. Torus visualization (3D torus with UV-mapped grid texture)
 */
export default function GridView({ resources, onSelectResource, isDarkMode = true }: GridViewProps) {
  const [step, setStep] = useState<DemoStep>('grid');
  const imageResources = useMemo(() => resources.filter(r => r.imageUrl), [resources]);

  const textColor = isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
  const mutedColor = isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
  const bgColor = isDarkMode ? '#1a1a1a' : '#f5f5f5';

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: bgColor }}>
      {/* Step navigation */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-3 py-2 rounded-full"
        style={{
          background: isDarkMode ? 'rgba(20,20,25,0.7)' : 'rgba(240,240,240,0.85)',
          backdropFilter: 'blur(12px)',
          border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
        }}
      >
        {([
          { key: 'carousel', label: '1. Carousel' },
          { key: 'infinite-row', label: '2. Infinite Row' },
          { key: 'grid', label: '3. Infinite Grid' },
          { key: 'torus', label: '4. Torus' },
        ] as { key: DemoStep; label: string }[]).map(s => (
          <button
            key={s.key}
            onClick={() => setStep(s.key)}
            className="px-3 py-1.5 rounded-full text-[11px] transition-all"
            style={{
              fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
              background: step === s.key ? (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)') : 'transparent',
              color: step === s.key ? textColor : mutedColor,
              fontWeight: step === s.key ? 500 : 400,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Demo content */}
      {step === 'carousel' && <CarouselDemo resources={imageResources} isDarkMode={isDarkMode} />}
      {step === 'infinite-row' && <InfiniteRowDemo resources={imageResources} isDarkMode={isDarkMode} />}
      {step === 'grid' && <InfiniteGridDemo resources={imageResources} onSelectResource={onSelectResource} isDarkMode={isDarkMode} />}
      {step === 'torus' && <TorusDemo resources={imageResources} isDarkMode={isDarkMode} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 1: Simple Carousel
   - Single image displayed at a time
   - mod(index, n) to loop
   ═══════════════════════════════════════════════════════════════ */
function CarouselDemo({ resources, isDarkMode }: { resources: Resource[]; isDarkMode: boolean }) {
  const [index, setIndex] = useState(0);
  const N = resources.length;

  const next = () => setIndex(i => mod(i + 1, N));
  const prev = () => setIndex(i => mod(i - 1, N));

  const item = resources[index];
  const textColor = isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
  const mutedColor = isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8">
      {/* Explanation */}
      <div className="text-center max-w-md" style={{ color: mutedColor, fontSize: 12, fontFamily: "'SF Mono', monospace", lineHeight: 1.6 }}>
        <p><strong style={{ color: textColor }}>Step 1: Simple Carousel</strong></p>
        <p className="mt-2">Track an index <code>i</code>. Advance with <code>i = mod(i + 1, n)</code>.</p>
        <p>The Euclidean modulo ensures wrapping: <code>mod(-1, {N}) = {N - 1}</code></p>
      </div>

      {/* Image */}
      <div className="relative" style={{ width: 280, height: 370 }}>
        <img
          src={item?.imageUrl || ''}
          alt={item?.title || ''}
          className="w-full h-full object-cover"
          style={{ transition: 'opacity 0.3s' }}
        />
        <div className="absolute bottom-0 inset-x-0 p-3" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
          <div className="text-white text-sm truncate">{item?.title}</div>
          <div className="text-white/50 text-xs">{item?.creator}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button onClick={prev} className="px-4 py-2 rounded-full text-sm" style={{ background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', color: textColor }}>
          ← Prev
        </button>
        <span className="text-xs" style={{ color: mutedColor, fontFamily: "'SF Mono', monospace" }}>
          {index} / {N}
        </span>
        <button onClick={next} className="px-4 py-2 rounded-full text-sm" style={{ background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', color: textColor }}>
          Next →
        </button>
      </div>

      {/* Code */}
      <pre className="text-[10px] px-4 py-3 rounded-lg max-w-md overflow-x-auto" style={{
        background: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)',
        color: mutedColor,
        fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
      }}>
{`const mod = (x, n) => ((x % n) + n) % n;
const [index, setIndex] = useState(0);
const next = () => setIndex(i => mod(i + 1, N));`}
      </pre>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 2: Infinite Row
   - Position on a number line (not discrete index)
   - VirtualRow renders only visible items
   - Periodic boundary maps infinite indices to finite items
   - Drag + momentum scrolling
   ═══════════════════════════════════════════════════════════════ */
function InfiniteRowDemo({ resources, isDarkMode }: { resources: Resource[]; isDarkMode: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const posStartRef = useRef(0);
  const velocityRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number>(0);

  const N = resources.length;
  const ITEM_WIDTH = 200;
  const GAP = 12;

  // Inertia animation
  useEffect(() => {
    let running = true;
    const step = () => {
      if (!isDragging.current && Math.abs(velocityRef.current) > 0.01) {
        setPosition(p => p + velocityRef.current);
        velocityRef.current *= 0.95; // damping
      }
      if (running) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    posStartRef.current = position;
    lastXRef.current = e.clientX;
    lastTimeRef.current = Date.now();
    velocityRef.current = 0;
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStartX.current;
      const now = Date.now();
      const dt = now - lastTimeRef.current;
      if (dt > 0) velocityRef.current = (e.clientX - lastXRef.current) / dt * 16;
      lastXRef.current = e.clientX;
      lastTimeRef.current = now;
      setPosition(posStartRef.current - dx / (ITEM_WIDTH + GAP));
    };
    const handleUp = () => { isDragging.current = false; };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [position]);

  // Wheel
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setPosition(p => p + e.deltaX / (ITEM_WIDTH + GAP) + e.deltaY / (ITEM_WIDTH + GAP));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Visible items
  const containerWidth = containerRef.current?.clientWidth || 800;
  const itemsVisible = Math.ceil(containerWidth / (ITEM_WIDTH + GAP)) + 4;
  const startIdx = Math.floor(position) - 2;

  const textColor = isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
  const mutedColor = isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Explanation */}
      <div className="text-center px-8 pt-16 pb-4" style={{ color: mutedColor, fontSize: 12, fontFamily: "'SF Mono', monospace", lineHeight: 1.6 }}>
        <p><strong style={{ color: textColor }}>Step 2: Infinite Row (Periodic 1D Space)</strong></p>
        <p className="mt-1">Position is a continuous value on a number line. Images wrap via <code>boundaryOp(index, 0, N)</code>.</p>
        <p>Drag or scroll horizontally. Release to see momentum inertia.</p>
      </div>

      {/* Row */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-grab"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-0 flex items-center">
          {Array.from({ length: itemsVisible }).map((_, i) => {
            const idx = startIdx + i;
            const resourceIdx = mod(idx, N);
            const resource = resources[resourceIdx];
            const offset = (idx - position) * (ITEM_WIDTH + GAP) + containerWidth / 2 - ITEM_WIDTH / 2;

            return (
              <div
                key={idx}
                className="absolute shrink-0"
                style={{
                  left: offset,
                  width: ITEM_WIDTH,
                  height: ITEM_WIDTH * 1.33,
                  transition: isDragging.current ? 'none' : 'left 0.05s linear',
                }}
              >
                <img
                  src={resource?.imageUrl || ''}
                  alt={resource?.title || ''}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
                <div className="absolute bottom-0 inset-x-0 p-2" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}>
                  <div className="text-[10px] text-white/80 truncate">{resource?.title}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Position indicator */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px]" style={{ color: mutedColor, fontFamily: "'SF Mono', monospace" }}>
          position: {position.toFixed(2)} → index: {mod(Math.round(position), N)}
        </div>
      </div>

      {/* Code */}
      <pre className="text-[10px] px-6 py-3 mx-8 mb-4 rounded-lg overflow-x-auto" style={{
        background: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)',
        color: mutedColor,
        fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
      }}>
{`const boundaryOp = (x, a, b) => a + mod(x - a, b - a);
const item = items[boundaryOp(index, 0, items.length)];
// Momentum: velocity *= 0.95 each frame (exponential decay)`}
      </pre>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 3: Infinite Grid
   - 2D periodic space (flat torus topology)
   - VirtualGrid renders only visible cells
   - Drag/scroll in any direction with inertia
   - goTo uses shortest connection for efficient navigation
   ═══════════════════════════════════════════════════════════════ */
function InfiniteGridDemo({ resources, onSelectResource, isDarkMode }: { resources: Resource[]; onSelectResource: (r: Resource) => void; isDarkMode: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { width: viewportWidth = 0, height: viewportHeight = 0 } = useResizeObserver({ ref: ref as any });

  const positionX = useMotionValue(0);
  const positionY = useMotionValue(0);

  const columns = useMemo(() => Math.max(1, Math.ceil(Math.sqrt(resources.length * 1.5))), [resources]);
  const rows = useMemo(() => Math.max(1, Math.ceil(resources.length / columns)), [resources, columns]);

  const viewportAspectRatio = viewportWidth && viewportHeight ? viewportWidth / viewportHeight : 4 / 3;
  const itemAspectRatio = 3 / 4;
  const itemsPerViewX = 4;
  const gapX = 0.012;
  const gapY = gapX * viewportAspectRatio;
  const itemWidth = (1 - (itemsPerViewX + 1) * gapX) / itemsPerViewX;
  const itemHeight = (itemWidth * viewportAspectRatio) / itemAspectRatio;
  const itemsPerViewY = (1 - gapY) / (itemHeight + gapY);

  const bind = useDragScroll(({ offset }) => {
    positionX.set((offset[0] / (viewportWidth || 1)) * itemsPerViewX);
    positionY.set((offset[1] / (viewportHeight || 1)) * itemsPerViewY);
  });

  // goTo random — demonstrates shortest path
  const goToRandom = useCallback(() => {
    const targetCol = Math.floor(Math.random() * columns);
    const targetRow = Math.floor(Math.random() * rows);
    const currentX = positionX.get();
    const targetX = currentX + getShortestConnection(currentX, targetCol, columns);
    const currentY = positionY.get();
    const targetY = currentY + getShortestConnection(currentY, targetRow, rows);
    animate(positionX, targetX, { type: "spring", mass: 0.1, restSpeed: 0.01 });
    animate(positionY, targetY, { type: "spring", mass: 0.1, restSpeed: 0.01 });
  }, [columns, rows, positionX, positionY]);

  const textColor = isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
  const mutedColor = isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';

  return (
    <div className="absolute inset-0">
      <div
        ref={ref}
        className="absolute inset-0 overflow-hidden overscroll-contain cursor-grab"
        style={{ touchAction: 'none' }}
        {...(typeof bind === 'function' ? (bind as any)() : {})}
      >
        <VirtualGrid
          position={[positionX, positionY]}
          itemsPerView={[itemsPerViewX, itemsPerViewY]}
          gap={[gapX, gapY]}
          transformValue={(value) => `${value * 100}%`}
          center
        >
          {({ column, row, x, y, width, height }) => {
            const indexX = mod(column, columns);
            const indexY = mod(row, rows);
            const resourceIdx = mod(indexY * columns + indexX, resources.length);
            const resource = resources[resourceIdx];
            if (!resource) return null;

            return (
              <motion.div
                className="absolute top-0 left-0 overflow-hidden will-change-transform cursor-pointer"
                style={{ x, y, width, height }}
                onClick={() => onSelectResource(resource)}
                whileHover={{ scale: 1.04, zIndex: 10 }}
                transition={{ duration: 0.2 }}
              >
                <img
                  src={resource.imageUrl!}
                  alt={resource.title}
                  className="w-full h-full object-cover"
                  draggable="false"
                  loading="lazy"
                />
              </motion.div>
            );
          }}
        </VirtualGrid>
      </div>

      {/* goTo random button */}
      <button
        onClick={goToRandom}
        className="fixed bottom-24 right-6 z-50 px-4 py-2 rounded-full text-[11px] transition-all hover:scale-105"
        style={{
          background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          color: textColor,
          fontFamily: "'SF Mono', monospace",
          backdropFilter: 'blur(8px)',
          border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
        }}
      >
        goTo(random) — shortest path ↗
      </button>

      {/* Info overlay */}
      <div className="fixed top-14 right-6 z-40 text-right" style={{ color: mutedColor, fontSize: 10, fontFamily: "'SF Mono', monospace", lineHeight: 1.5 }}>
        <p><strong style={{ color: textColor }}>Step 3: Infinite Grid</strong></p>
        <p>2D periodic space (flat torus)</p>
        <p>Drag or scroll in any direction</p>
        <p>{columns}×{rows} = {resources.length} images, infinite tiles</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 4: Torus Visualization
   - 3D torus with grid texture UV-mapped onto surface
   - Demonstrates that infinite 2D grid = flat torus topology
   - Orbit camera to explore
   ═══════════════════════════════════════════════════════════════ */
function TorusDemo({ resources, isDarkMode }: { resources: Resource[]; isDarkMode: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [mode, setMode] = useState<'torus' | 'flat'>('torus');

  const textColor = isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
  const mutedColor = isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDarkMode ? '#1a1a1a' : '#f5f5f5');

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(0, 3, 6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create grid texture from resource images
    const textureSize = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = textureSize;
    canvas.height = textureSize;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = isDarkMode ? '#1a1a1a' : '#f5f5f5';
    ctx.fillRect(0, 0, textureSize, textureSize);

    // Draw grid of images onto canvas
    const cols = Math.ceil(Math.sqrt(resources.length));
    const rows = Math.ceil(resources.length / cols);
    const cellW = textureSize / cols;
    const cellH = textureSize / rows;

    let loadedCount = 0;
    resources.forEach((r, i) => {
      if (!r.imageUrl) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        ctx.drawImage(img, col * cellW, row * cellH, cellW, cellH);
        loadedCount++;
        if (loadedCount >= Math.min(resources.length, 20)) {
          texture.needsUpdate = true;
        }
      };
      img.src = r.imageUrl!;
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // Torus geometry
    const torusGeometry = new THREE.TorusGeometry(2, 0.8, 64, 100);
    const torusMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    const torus = new THREE.Mesh(torusGeometry, torusMaterial);

    // Flat plane (for comparison)
    const planeGeometry = new THREE.PlaneGeometry(4, 4);
    const planeMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.visible = false;

    scene.add(torus);
    scene.add(plane);

    // Orbit rotation
    let theta = 0;
    let phi = Math.PI / 4;
    let radius = 6;
    let autoRotate = true;

    const animateScene = () => {
      if (autoRotate) theta += 0.003;

      if (mode === 'torus') {
        torus.visible = true;
        plane.visible = false;
      } else {
        torus.visible = false;
        plane.visible = true;
      }

      camera.position.x = radius * Math.sin(phi) * Math.cos(theta);
      camera.position.y = radius * Math.cos(phi);
      camera.position.z = radius * Math.sin(phi) * Math.sin(theta);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      requestAnimationFrame(animateScene);
    };
    const raf = requestAnimationFrame(animateScene);

    // Drag to orbit
    let dragging = false;
    let lastX = 0, lastY = 0;
    const onDown = (e: MouseEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; autoRotate = false; };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      theta -= (e.clientX - lastX) * 0.01;
      phi = Math.max(0.3, Math.min(Math.PI - 0.3, phi + (e.clientY - lastY) * 0.01));
      lastX = e.clientX; lastY = e.clientY;
    };
    const onUp = () => { dragging = false; autoRotate = true; };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); radius = Math.max(3, Math.min(12, radius + e.deltaY * 0.01)); };

    mount.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    mount.addEventListener('wheel', onWheel, { passive: false });

    const handleResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
      mount.removeEventListener('mousedown', onDown);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      mount.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [resources, isDarkMode, mode]);

  return (
    <div className="absolute inset-0">
      <div ref={mountRef} className="w-full h-full" />

      {/* Mode toggle */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex gap-2">
        <button
          onClick={() => setMode('torus')}
          className="px-4 py-2 rounded-full text-[11px] transition-all"
          style={{
            background: mode === 'torus' ? (isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)') : 'transparent',
            color: textColor,
            fontFamily: "'SF Mono', monospace",
            border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
            backdropFilter: 'blur(8px)',
          }}
        >
          3D Torus
        </button>
        <button
          onClick={() => setMode('flat')}
          className="px-4 py-2 rounded-full text-[11px] transition-all"
          style={{
            background: mode === 'flat' ? (isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)') : 'transparent',
            color: textColor,
            fontFamily: "'SF Mono', monospace",
            border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
            backdropFilter: 'blur(8px)',
          }}
        >
          Flat Torus
        </button>
      </div>

      {/* Info */}
      <div className="fixed top-14 right-6 z-40 text-right max-w-xs" style={{ color: mutedColor, fontSize: 10, fontFamily: "'SF Mono', monospace", lineHeight: 1.6 }}>
        <p><strong style={{ color: textColor }}>Step 4: The Torus</strong></p>
        <p className="mt-1">A 2D periodic space is topologically equivalent to a torus.</p>
        <p>Scrolling the infinite grid = traveling across the torus surface.</p>
        <p className="mt-1">Drag to orbit. Scroll to zoom.</p>
      </div>
    </div>
  );
}
