import { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import type { Resource } from '../types';

interface ExploreViewProps {
  resources: Resource[];
  onSelectResource: (r: Resource) => void;
  isDarkMode?: boolean;
}

/**
 * ExploreView — 10m.co-style 3D particle cloud visualization.
 * Images float as planes in 3D space. Rotate with drag, zoom with scroll.
 * Click an image to select it.
 */
export default function ExploreView({ resources, onSelectResource, isDarkMode = true }: ExploreViewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const rafRef = useRef<number>(0);
  const [hoveredResource, setHoveredResource] = useState<Resource | null>(null);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Only resources with images
  const imageResources = useMemo(() => resources.filter(r => r.imageUrl), [resources]);

  // Camera orbit state
  const isRotating = useRef(false);
  const rotStartX = useRef(0);
  const rotStartY = useRef(0);
  const spherical = useRef({ theta: 0, phi: Math.PI / 2.5, radius: 500 });
  const targetSpherical = useRef({ theta: 0, phi: Math.PI / 2.5, radius: 500 });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDarkMode ? '#1a1a1a' : '#f5f5f5');
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 1, 3000);
    camera.position.set(0, 100, 500);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Ambient light
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    // Create image planes distributed in 3D space
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = 'anonymous';
    const meshes: THREE.Mesh[] = [];

    // Distribute in a sphere/cloud pattern
    const N = imageResources.length;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    imageResources.forEach((resource, i) => {
      // Fibonacci sphere distribution
      const y = 1 - (i / (N - 1)) * 2; // -1 to 1
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;

      const spread = 300;
      const x = Math.cos(theta) * radiusAtY * spread;
      const z = Math.sin(theta) * radiusAtY * spread;
      const posY = y * spread * 0.6;

      // Create plane with image texture
      const planeSize = 30 + Math.random() * 20;
      const geometry = new THREE.PlaneGeometry(planeSize, planeSize * (resource.aspectRatio ? parseFloat(resource.aspectRatio) : 1));
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, posY, z);
      mesh.userData = { resource, index: i };

      // Load texture
      textureLoader.load(
        resource.imageUrl!,
        (texture: THREE.Texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          (mesh.material as THREE.MeshBasicMaterial).map = texture;
          (mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
        },
        undefined,
        () => {} // silently fail
      );

      scene.add(mesh);
      meshes.push(mesh);
    });

    meshesRef.current = meshes;

    // Animation loop
    function animate() {
      // Lerp spherical coordinates
      const s = spherical.current;
      const t = targetSpherical.current;
      s.theta += (t.theta - s.theta) * 0.05;
      s.phi += (t.phi - s.phi) * 0.05;
      s.radius += (t.radius - s.radius) * 0.08;

      // Convert spherical to cartesian
      const x = s.radius * Math.sin(s.phi) * Math.cos(s.theta);
      const y = s.radius * Math.cos(s.phi);
      const z = s.radius * Math.sin(s.phi) * Math.sin(s.theta);

      camera.position.set(x, y, z);
      camera.lookAt(0, 0, 0);

      // Make planes face camera (billboard)
      meshes.forEach(mesh => {
        mesh.lookAt(camera.position);
      });

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    // Resize handler
    const handleResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      meshes.forEach(m => {
        m.geometry.dispose();
        (m.material as THREE.MeshBasicMaterial).dispose();
      });
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [imageResources, isDarkMode]);

  // Mouse interaction: rotate
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const handleMouseDown = (e: MouseEvent) => {
      isRotating.current = true;
      rotStartX.current = e.clientX;
      rotStartY.current = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isRotating.current) {
        const dx = e.clientX - rotStartX.current;
        const dy = e.clientY - rotStartY.current;
        targetSpherical.current.theta -= dx * 0.005;
        targetSpherical.current.phi = Math.max(0.3, Math.min(Math.PI - 0.3, targetSpherical.current.phi + dy * 0.005));
        rotStartX.current = e.clientX;
        rotStartY.current = e.clientY;
      } else {
        // Raycast for hover
        const rect = mount.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        if (cameraRef.current) {
          raycaster.setFromCamera(mouse, cameraRef.current);
          const intersects = raycaster.intersectObjects(meshesRef.current);
          if (intersects.length > 0) {
            const hit = intersects[0].object as THREE.Mesh;
            setHoveredResource(hit.userData.resource);
            setTooltipPos({ x: e.clientX, y: e.clientY });
            mount.style.cursor = 'pointer';
          } else {
            setHoveredResource(null);
            mount.style.cursor = 'grab';
          }
        }
      }
    };

    const handleMouseUp = () => {
      isRotating.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetSpherical.current.radius = Math.max(150, Math.min(1200, targetSpherical.current.radius + e.deltaY * 0.5));
    };

    const handleClick = (e: MouseEvent) => {
      if (!cameraRef.current) return;
      const rect = mount.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObjects(meshesRef.current);
      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        setSelectedResource(hit.userData.resource);
        onSelectResource(hit.userData.resource);
      }
    };

    mount.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    mount.addEventListener('wheel', handleWheel, { passive: false });
    mount.addEventListener('click', handleClick);

    return () => {
      mount.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      mount.removeEventListener('wheel', handleWheel);
      mount.removeEventListener('click', handleClick);
    };
  }, [onSelectResource]);

  // Compute related works for selected resource
  const relatedWorks = useMemo(() => {
    if (!selectedResource) return [];
    const related = new Map<number, number>(); // resourceId -> score
    resources.forEach(r => {
      if (r.id === selectedResource.id || !r.imageUrl) return;
      let score = 0;
      if (r.type === selectedResource.type) score += 3;
      if (r.creator && r.creator === selectedResource.creator) score += 5;
      const sharedThemes = (r.themes || []).filter(t => (selectedResource.themes || []).includes(t));
      score += sharedThemes.length * 2;
      if (r.dominantHue && selectedResource.dominantHue) {
        const hueDiff = Math.min(Math.abs(r.dominantHue - selectedResource.dominantHue), 360 - Math.abs(r.dominantHue - selectedResource.dominantHue));
        if (hueDiff <= 30) score += 2;
      }
      if (score > 0) related.set(r.id, score);
    });
    return Array.from(related.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16)
      .map(([id]) => resources.find(r => r.id === id)!)
      .filter(Boolean);
  }, [selectedResource, resources]);

  return (
    <div className="absolute inset-0 flex">
      {/* 3D Canvas */}
      <div ref={mountRef} className="flex-1 h-full" />

      {/* Hover tooltip */}
      {hoveredResource && !selectedResource && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y + 12,
          }}
        >
          <div
            className="px-3 py-2 rounded-lg"
            style={{
              background: isDarkMode ? 'rgba(10,10,12,0.9)' : 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(8px)',
              border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
              maxWidth: 200,
            }}
          >
            <div className={`text-[11px] truncate ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>
              {hoveredResource.title}
            </div>
            {hoveredResource.creator && (
              <div className={`text-[9px] ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}>
                {hoveredResource.creator}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail + Related Works side panel (10m.co style) */}
      {selectedResource && (
        <div
          className="h-full overflow-y-auto shrink-0"
          style={{
            width: 360,
            background: isDarkMode ? 'rgba(20,20,22,0.95)' : 'rgba(250,248,244,0.97)',
            backdropFilter: 'blur(12px)',
            borderLeft: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setSelectedResource(null)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full transition-opacity hover:opacity-100"
            style={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', opacity: 0.6 }}
          >
            ✕
          </button>

          {/* Image */}
          <div className="w-full aspect-square overflow-hidden">
            <img
              src={selectedResource.imageUrl || ''}
              alt={selectedResource.title}
              className="w-full h-full object-contain"
              style={{ background: isDarkMode ? '#111' : '#eee' }}
            />
          </div>

          {/* Info */}
          <div className="p-5">
            {/* Type badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ background: 'hsl(48, 75%, 55%)' }} />
              <span className="text-[10px] uppercase tracking-wider" style={{ color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>
                {selectedResource.type}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-lg font-medium mb-3" style={{ color: isDarkMode ? '#fff' : '#000' }}>
              {selectedResource.title}
            </h2>

            {/* Metadata grid */}
            <div className="grid gap-1 mb-4" style={{ fontSize: 13 }}>
              {selectedResource.creator && (
                <div className="grid grid-cols-[80px_1fr]">
                  <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>CREATOR</span>
                  <span style={{ color: isDarkMode ? '#fff' : '#000' }}>{selectedResource.creator}</span>
                </div>
              )}
              {selectedResource.year && (
                <div className="grid grid-cols-[80px_1fr]">
                  <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>YEAR</span>
                  <span style={{ color: isDarkMode ? '#fff' : '#000' }}>{selectedResource.year}</span>
                </div>
              )}
              {selectedResource.language && (
                <div className="grid grid-cols-[80px_1fr]">
                  <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>LANGUAGE</span>
                  <span style={{ color: isDarkMode ? '#fff' : '#000' }}>{selectedResource.language}</span>
                </div>
              )}
              {selectedResource.location && (
                <div className="grid grid-cols-[80px_1fr]">
                  <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>LOCATION</span>
                  <span style={{ color: isDarkMode ? '#fff' : '#000' }}>{selectedResource.location}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {selectedResource.description && (
              <p className="mb-4" style={{ fontSize: 13, lineHeight: 1.7, color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>
                {selectedResource.description}
              </p>
            )}

            {/* Themes */}
            {selectedResource.themes && selectedResource.themes.length > 0 && (
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}>Themes</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedResource.themes.map(t => (
                    <span key={t} className="px-2 py-0.5 rounded text-[11px]" style={{ background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {selectedResource.tags && selectedResource.tags.length > 0 && (
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}>Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedResource.tags.map(t => (
                    <span key={t} className="px-2 py-0.5 rounded text-[11px]" style={{ background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Related Works */}
            {relatedWorks.length > 0 && (
              <div className="mt-6">
                <div className="text-[11px] uppercase tracking-wider mb-3 font-medium" style={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>Related Works</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {relatedWorks.map(r => (
                    <button
                      key={r.id}
                      onClick={() => { setSelectedResource(r); onSelectResource(r); }}
                      className="aspect-square overflow-hidden rounded-sm transition-opacity hover:opacity-80"
                    >
                      <img src={r.imageUrl!} alt={r.title} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
