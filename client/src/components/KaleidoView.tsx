import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import type { Resource, Connection } from "../types";
import { TYPE_COLORS } from "../types";
import { useIsMobile, useIsNarrow } from "@/hooks/useIsMobile";

interface KaleidoViewProps {
  resources: Resource[];
  connections: Connection[];
  onSelectResource: (r: Resource) => void;
}

/* ─── Helpers ─── */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/* Rainbow hue for grid cells */
function rainbowColor(index: number, total: number, alpha = 0.12): string {
  const hue = (index / total) * 360;
  return `hsla(${hue}, 55%, 65%, ${alpha})`;
}

function rainbowBorder(index: number, total: number): string {
  const hue = (index / total) * 360;
  return `hsla(${hue}, 45%, 55%, 0.18)`;
}

/* ─── Classification ─── */
const classifyByType = (r: Resource) => r.type;

const GROUPINGS = [
  { id: 'type', label: 'TYPE', classify: classifyByType },
] as const;

/* ─── Node position type ─── */
interface NodePos {
  resource: Resource;
  x: number;
  y: number;
  tx: number;
  ty: number;
  w: number;
  h: number;
  baseX: number;
  baseY: number;
  category: string;
  relation: 'self' | 'connected' | 'same-category' | 'none';
}

export default function KaleidoView({ resources, connections, onSelectResource }: KaleidoViewProps) {
  const isMobile = useIsMobile();
  const isNarrow = useIsNarrow();
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const nodesRef = useRef<NodePos[]>([]);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [mode, setMode] = useState<'scatter' | 'orbit'>('scatter');

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build connection lookup
  const connectionMap = useMemo(() => {
    const map = new Map<number, { otherId: number; conn: Connection }[]>();
    connections.forEach(c => {
      if (!map.has(c.sourceId)) map.set(c.sourceId, []);
      if (!map.has(c.targetId)) map.set(c.targetId, []);
      map.get(c.sourceId)!.push({ otherId: c.targetId, conn: c });
      map.get(c.targetId)!.push({ otherId: c.sourceId, conn: c });
    });
    return map;
  }, [connections]);

  // Compute initial constellation positions (scatter mode)
  const basePositions = useMemo(() => {
    if (!containerSize.width || !containerSize.height || resources.length === 0) return [];

    const vw = containerSize.width;
    const vh = containerSize.height;
    const cx = vw / 2;
    const cy = vh / 2;
    const N = resources.length;

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const maxR = Math.min(vw, vh) * 0.40;

    return resources.map((r, i) => {
      const rng = seededRandom(r.id * 7 + 3);
      const angle = i * goldenAngle;
      const radius = maxR * Math.sqrt((i + 1) / N) * (0.85 + rng() * 0.3);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      const baseSize = isMobile ? 40 : isNarrow ? 55 : 70;
      const sizeVar = 0.7 + rng() * 0.6;
      const w = r.imageUrl ? baseSize * sizeVar : baseSize * 0.6 * sizeVar;
      const h = r.imageUrl ? w * (r.aspectRatio ? parseFloat(r.aspectRatio) : 1.2) : w;

      return { resource: r, x, y, baseX: x, baseY: y, w, h: Math.min(h, w * 1.5) };
    });
  }, [resources, containerSize, isMobile, isNarrow]);

  // Compute orbit positions when a resource is selected
  const computeOrbitPositions = useCallback((selectedResource: Resource) => {
    if (!containerSize.width || !containerSize.height) return null;

    const vw = containerSize.width;
    const vh = containerSize.height;
    const cx = vw / 2;
    const cy = vh / 2;

    const connectedIds = new Set<number>();
    const conns = connectionMap.get(selectedResource.id) || [];
    conns.forEach(c => connectedIds.add(c.otherId));

    const grouping = GROUPINGS[0];
    const selectedCategory = grouping.classify(selectedResource);

    const positions: Map<number, { tx: number; ty: number; relation: NodePos['relation']; category: string }> = new Map();

    // Self: center
    positions.set(selectedResource.id, { tx: cx, ty: cy, relation: 'self', category: selectedCategory });

    // Connected: inner ring
    const connected = resources.filter(r => r.id !== selectedResource.id && connectedIds.has(r.id));
    const rScale = isMobile ? 0.7 : isNarrow ? 0.85 : 1;
    const innerR = Math.min(vw, vh) * 0.18 * rScale;
    connected.forEach((r, i) => {
      const angle = (i / Math.max(connected.length, 1)) * Math.PI * 2 - Math.PI / 2;
      positions.set(r.id, {
        tx: cx + Math.cos(angle) * innerR,
        ty: cy + Math.sin(angle) * innerR,
        relation: 'connected',
        category: grouping.classify(r),
      });
    });

    // Same category: middle ring
    const sameCategory = resources.filter(r => !positions.has(r.id) && grouping.classify(r) === selectedCategory);
    const midR = Math.min(vw, vh) * 0.32 * rScale;
    sameCategory.forEach((r, i) => {
      const angle = (i / Math.max(sameCategory.length, 1)) * Math.PI * 2 - Math.PI / 2;
      positions.set(r.id, {
        tx: cx + Math.cos(angle) * midR,
        ty: cy + Math.sin(angle) * midR,
        relation: 'same-category',
        category: grouping.classify(r),
      });
    });

    // Rest: outer ring
    const rest = resources.filter(r => !positions.has(r.id));
    const outerR = Math.min(vw, vh) * 0.44 * rScale;
    rest.forEach((r, i) => {
      const angle = (i / Math.max(rest.length, 1)) * Math.PI * 2 - Math.PI / 2;
      positions.set(r.id, {
        tx: cx + Math.cos(angle) * outerR,
        ty: cy + Math.sin(angle) * outerR,
        relation: 'none',
        category: grouping.classify(r),
      });
    });

    return positions;
  }, [resources, containerSize, connectionMap, isMobile, isNarrow]);

  // Initialize nodes
  useEffect(() => {
    if (basePositions.length === 0) return;
    nodesRef.current = basePositions.map(bp => ({
      ...bp,
      tx: bp.x,
      ty: bp.y,
      category: GROUPINGS[0].classify(bp.resource),
      relation: 'none' as const,
    }));
    setRevealed(true);
  }, [basePositions]);

  // Update targets when selection changes
  useEffect(() => {
    if (!nodesRef.current.length) return;

    if (selectedId === null) {
      setMode('scatter');
      nodesRef.current.forEach(node => {
        node.tx = node.baseX;
        node.ty = node.baseY;
        node.relation = 'none';
      });
    } else {
      const selectedResource = resources.find(r => r.id === selectedId);
      if (!selectedResource) return;
      setMode('orbit');
      const orbitPositions = computeOrbitPositions(selectedResource);
      if (!orbitPositions) return;

      nodesRef.current.forEach(node => {
        const pos = orbitPositions.get(node.resource.id);
        if (pos) {
          node.tx = pos.tx;
          node.ty = pos.ty;
          node.relation = pos.relation;
          node.category = pos.category;
        }
      });
    }
  }, [selectedId, resources, computeOrbitPositions]);

  // Animation loop
  useEffect(() => {
    if (!nodesRef.current.length || !innerRef.current) return;

    function animate() {
      const inner = innerRef.current;
      if (!inner) return;

      const items = inner.querySelectorAll<HTMLElement>('[data-kaleido-item]');
      nodesRef.current.forEach((node, i) => {
        node.x = lerp(node.x, node.tx, 0.06);
        node.y = lerp(node.y, node.ty, 0.06);

        const el = items[i];
        if (el) {
          el.style.transform = `translate3d(${node.x - node.w / 2}px, ${node.y - node.h / 2}px, 0)`;
        }
      });

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [basePositions]);

  // Handlers
  const handleClick = useCallback((r: Resource) => {
    if (selectedId === r.id) {
      setSelectedId(null);
    } else {
      setSelectedId(r.id);
      onSelectResource(r);
    }
  }, [selectedId, onSelectResource]);

  // Get connected resources for selected
  const selectedConnections = useMemo(() => {
    if (selectedId === null) return [];
    return connectionMap.get(selectedId) || [];
  }, [selectedId, connectionMap]);

  const selectedResource = useMemo(() => resources.find(r => r.id === selectedId) ?? null, [resources, selectedId]);

  // Grid layout for background
  const gridLayout = useMemo(() => {
    if (!containerSize.width || !containerSize.height) return { cols: 0, rows: 0, cellW: 0, cellH: 0 };
    const cellTarget = isMobile ? 70 : 55;
    const cols = Math.ceil(containerSize.width / cellTarget);
    const rows = Math.ceil(containerSize.height / cellTarget);
    const cellW = containerSize.width / cols;
    const cellH = containerSize.height / rows;
    return { cols, rows, cellW, cellH };
  }, [containerSize, isMobile]);

  // Sort resources by hue for rainbow ordering
  const sortedByHue = useMemo(() => {
    return [...resources].sort((a, b) => (a.dominantHue ?? 180) - (b.dominantHue ?? 180));
  }, [resources]);

  // Assign resources to grid cells
  const gridCells = useMemo(() => {
    const { cols, rows } = gridLayout;
    const total = cols * rows;
    if (total === 0) return [];
    const cells: { resource: Resource; col: number; row: number; idx: number }[] = [];
    for (let i = 0; i < total; i++) {
      const r = sortedByHue[i % sortedByHue.length];
      cells.push({ resource: r, col: i % cols, row: Math.floor(i / cols), idx: i });
    }
    return cells;
  }, [gridLayout, sortedByHue]);

  const totalCells = gridLayout.cols * gridLayout.rows;

  /* ─── Render ─── */
  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden" style={{ background: '#0a0a0a' }}>
      {/* ─── Background: Rainbow Grid ─── */}
      <div className="absolute inset-0" style={{ opacity: revealed ? 1 : 0, transition: 'opacity 1.5s ease-out' }}>
        {gridCells.map((cell) => {
          const { resource: r, col, row, idx } = cell;
          const { cellW, cellH } = gridLayout;
          return (
            <div
              key={`${col}-${row}`}
              className="absolute overflow-hidden"
              style={{
                left: col * cellW,
                top: row * cellH,
                width: cellW,
                height: cellH,
                borderRight: `0.5px solid ${rainbowBorder(idx, totalCells)}`,
                borderBottom: `0.5px solid ${rainbowBorder(idx, totalCells)}`,
                background: rainbowColor(idx, totalCells, 0.04),
              }}
            >
              <div className="w-full h-full flex flex-col justify-center px-1" style={{ overflow: 'hidden' }}>
                <span
                  className="block truncate"
                  style={{
                    fontSize: isMobile ? 5 : 7,
                    fontWeight: 500,
                    color: rainbowColor(idx, totalCells, 0.55),
                    lineHeight: 1.2,
                    letterSpacing: '0.02em',
                  }}
                >
                  {r.title}
                </span>
                <span
                  className="block truncate"
                  style={{
                    fontSize: isMobile ? 4 : 5.5,
                    color: rainbowColor(idx, totalCells, 0.3),
                    lineHeight: 1.2,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {r.type}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── SVG connection lines (orbit mode) ─── */}
      {mode === 'orbit' && selectedId !== null && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {nodesRef.current.filter(n => n.relation === 'connected').map((node, i) => {
            const selfNode = nodesRef.current.find(n => n.resource.id === selectedId);
            if (!selfNode) return null;
            const conn = selectedConnections.find(c => c.otherId === node.resource.id);
            return (
              <line
                key={`conn-line-${i}`}
                x1={selfNode.x}
                y1={selfNode.y}
                x2={node.x}
                y2={node.y}
                stroke={conn?.conn.color || 'rgba(255,255,255,0.2)'}
                strokeWidth="1"
                strokeOpacity="0.4"
                strokeDasharray="4 4"
              />
            );
          })}
        </svg>
      )}

      {/* ─── Foreground: Animated Items (Orbit-style) ─── */}
      <div ref={innerRef} className="absolute inset-0 z-20">
        {nodesRef.current.map((node, i) => {
          const r = node.resource;
          const isSelected = selectedId === r.id;
          const isHovered = hoveredId === r.id;
          const isConnected = node.relation === 'connected';
          const isDimmed = mode === 'orbit' && node.relation === 'none';
          const hasImage = !!r.imageUrl;

          let scale = 1;
          if (isSelected) scale = isMobile ? 1.8 : 2.2;
          else if (isHovered) scale = 1.3;
          else if (isConnected) scale = 1.1;
          else if (isDimmed) scale = 0.6;

          const rng = seededRandom(r.id * 13 + i);
          const revealDelay = 50 + rng() * 600;

          return (
            <div
              key={r.id}
              data-kaleido-item
              className="absolute cursor-pointer"
              style={{
                width: node.w,
                height: node.h,
                zIndex: isSelected ? 200 : isHovered ? 150 : isConnected ? 100 : 10,
                willChange: 'transform',
                opacity: revealed ? (isDimmed ? 0.15 : 1) : 0,
                transition: `opacity 0.6s ease-out ${revealed ? revealDelay + 'ms' : '0ms'}, width 0.4s, height 0.4s`,
              }}
              onMouseEnter={() => setHoveredId(r.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleClick(r)}
            >
              <div
                className="w-full h-full relative overflow-hidden rounded-sm"
                style={{
                  transform: `scale(${scale})`,
                  transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 0.4s',
                  boxShadow: isSelected
                    ? `0 0 40px 8px ${TYPE_COLORS[r.type] || 'rgba(255,255,255,0.2)'}40`
                    : isHovered
                    ? '0 4px 20px rgba(0,0,0,0.5)'
                    : 'none',
                  border: isSelected
                    ? `2px solid ${TYPE_COLORS[r.type] || 'rgba(255,255,255,0.4)'}`
                    : isConnected
                    ? '1px solid rgba(255,255,255,0.2)'
                    : '1px solid rgba(255,255,255,0.04)',
                }}
              >
                {hasImage ? (
                  <img
                    src={r.imageUrl!}
                    alt={r.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center p-2"
                    style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                  >
                    {r.quoteText ? (
                      <p
                        className="text-center leading-tight"
                        style={{
                          fontFamily: "'EB Garamond', serif",
                          fontSize: 10,
                          color: 'rgba(255,255,255,0.5)',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {r.quoteText}
                      </p>
                    ) : (
                      <span
                        style={{
                          fontFamily: "'EB Garamond', serif",
                          fontSize: 9,
                          color: 'rgba(255,255,255,0.3)',
                          textAlign: 'center',
                        }}
                      >
                        {r.title}
                      </span>
                    )}
                  </div>
                )}

                {/* Category color indicator */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{
                    backgroundColor: TYPE_COLORS[r.type] || 'rgba(255,255,255,0.2)',
                    opacity: isSelected || isHovered || isConnected ? 0.8 : 0.2,
                    transition: 'opacity 0.3s',
                  }}
                />
              </div>

              {/* Title on hover */}
              {(isHovered || isSelected) && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap"
                  style={{ top: '100%', marginTop: 6, zIndex: 300 }}
                >
                  <div
                    className="px-2 py-1 rounded"
                    style={{
                      background: 'rgba(10,10,12,0.9)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div className="text-[10px] text-white/80 max-w-[180px] truncate" style={{ fontFamily: "'EB Garamond', serif" }}>
                      {r.title}
                    </div>
                    {r.creator && (
                      <div className="text-[8px] text-white/35">{r.creator}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>


      {/* ─── Mode indicator ─── */}
      {!isMobile && !isNarrow && (
        <div className="absolute top-4 right-4 z-30">
          <div
            className="px-3 py-2 rounded-lg"
            style={{
              background: 'rgba(20,20,25,0.7)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div
              className="text-[9px] uppercase tracking-[0.12em] text-white/40"
              style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace" }}
            >
              {mode === 'scatter' ? 'Kaleido' : 'Orbit'}
            </div>
            <div className="text-[8px] mt-1 text-white/20" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace" }}>
              {mode === 'scatter'
                ? 'Click any image to orbit'
                : 'Click center to return'
              }
            </div>
          </div>
        </div>
      )}

      {/* ─── Stats ─── */}
      <div
        className={`absolute z-30 select-none ${isMobile ? 'bottom-16 right-3' : 'bottom-20 right-6'}`}
        style={{ color: 'rgba(255,255,255,0.12)', fontSize: 10 }}
      >
        {resources.length} entries
      </div>
    </div>
  );
}
