import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import type { Resource, Connection } from "../types";
import { TYPE_COLORS } from "../types";
import { useIsMobile, useIsNarrow } from "@/hooks/useIsMobile";

interface OrbitViewProps {
  resources: Resource[];
  connections: Connection[];
  onSelectResource: (r: Resource) => void;
  isDarkMode?: boolean;
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

function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/* ─── Classification (same as IrisView) ─── */
const classifyByType = (r: Resource) => r.type;

const classifyByEra = (r: Resource): string => {
  const y = r.year ?? 2020;
  if (y < 1960) return 'Pre-1960';
  if (y < 1980) return '1960s–70s';
  if (y < 2000) return '1980s–90s';
  if (y < 2010) return '2000s';
  if (y < 2020) return '2010s';
  return '2020s';
};

const classifyByMedium = (r: Resource): string => {
  const t = r.type;
  if (['film', 'video'].includes(t)) return 'Moving Image';
  if (['music'].includes(t)) return 'Sound';
  if (['book', 'writing', 'quote'].includes(t)) return 'Text';
  if (['art', 'design'].includes(t)) return 'Visual';
  if (['architecture'].includes(t)) return 'Spatial';
  if (['technology'].includes(t)) return 'Digital';
  return 'Other';
};

const GROUPINGS = [
  { id: 'type', label: 'TYPE', classify: classifyByType },
  { id: 'era', label: 'ERA', classify: classifyByEra },
  { id: 'medium', label: 'MEDIUM', classify: classifyByMedium },
  { id: 'connection', label: 'LINKED', classify: classifyByType }, // special: uses connections
] as const;

/* ─── Position types ─── */
interface NodePos {
  resource: Resource;
  // Current animated position
  x: number;
  y: number;
  // Target position
  tx: number;
  ty: number;
  // Size
  w: number;
  h: number;
  // Base (constellation) position
  baseX: number;
  baseY: number;
  // Category for current grouping
  category: string;
  // Relationship to selected
  relation: 'self' | 'connected' | 'same-category' | 'none';
}

export default function OrbitView({ resources, connections, onSelectResource, isDarkMode = true }: OrbitViewProps) {
  const isMobile = useIsMobile();
  const isNarrow = useIsNarrow();
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const nodesRef = useRef<NodePos[]>([]);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [activeGrouping, setActiveGrouping] = useState(0);
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

    // Golden angle spiral for organic distribution
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const maxR = Math.min(vw, vh) * 0.32;

    return resources.map((r, i) => {
      const rng = seededRandom(r.id * 7 + 3);
      const angle = i * goldenAngle;
      const radius = maxR * Math.sqrt((i + 1) / N) * (0.85 + rng() * 0.3);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      // Size based on whether it has an image
      const baseSize = isMobile ? 40 : isNarrow ? 55 : 70;
      const sizeVar = 0.7 + rng() * 0.6;
      const w = r.imageUrl ? baseSize * sizeVar : baseSize * 0.6 * sizeVar;
      // For images: use actual aspect ratio so frame matches image exactly
      // aspectRatio field stores height/width ratio
      const h = r.imageUrl ? w * (r.aspectRatio ? parseFloat(r.aspectRatio) : 1.0) : w;

      return { resource: r, x, y, baseX: x, baseY: y, w, h };
    });
  }, [resources, containerSize, isMobile, isNarrow]);

  // Compute orbit positions when a resource is selected
  const computeOrbitPositions = useCallback((selectedResource: Resource, groupingIdx: number) => {
    if (!containerSize.width || !containerSize.height) return null;

    const vw = containerSize.width;
    const vh = containerSize.height;
    const cx = vw / 2;
    const cy = vh / 2;

    // Get connected resource IDs
    const connectedIds = new Set<number>();
    const conns = connectionMap.get(selectedResource.id) || [];
    conns.forEach(c => connectedIds.add(c.otherId));

    // Classify all resources
    const grouping = GROUPINGS[groupingIdx];
    const selectedCategory = grouping.classify(selectedResource);

    // Sort resources into rings: self → connected → same category → rest
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

    // Same category (not already placed): middle ring
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

    // Rest: outer ring (grouped by their category)
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
      category: GROUPINGS[activeGrouping].classify(bp.resource),
      relation: 'none' as const,
    }));
    setRevealed(true);
  }, [basePositions, activeGrouping]);

  // Update targets when selection changes
  useEffect(() => {
    if (!nodesRef.current.length) return;

    if (selectedId === null) {
      // Return to scatter
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
      const orbitPositions = computeOrbitPositions(selectedResource, activeGrouping);
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
  }, [selectedId, activeGrouping, resources, computeOrbitPositions]);

  // Animation loop
  useEffect(() => {
    if (!nodesRef.current.length || !innerRef.current) return;

    function animate() {
      const inner = innerRef.current;
      if (!inner) return;

      const items = inner.querySelectorAll<HTMLElement>('[data-orbit-item]');
      nodesRef.current.forEach((node, i) => {
        // Lerp position
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

  // Selected resource
  const selectedResource = useMemo(() => resources.find(r => r.id === selectedId) ?? null, [resources, selectedId]);

  /* ─── Render ─── */
  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: isDarkMode ? '#0A0A0C' : '#ffffff' }}
    >
      {/* SVG connection lines (only in orbit mode) */}
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
          {/* Ring guides */}
          {selectedId !== null && containerSize.width > 0 && (
            <>
              <circle
                cx={containerSize.width / 2}
                cy={containerSize.height / 2}
                r={Math.min(containerSize.width, containerSize.height) * 0.18}
                fill="none"
                stroke={isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}
                strokeWidth="0.5"
              />
              <circle
                cx={containerSize.width / 2}
                cy={containerSize.height / 2}
                r={Math.min(containerSize.width, containerSize.height) * 0.32}
                fill="none"
                stroke={isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}
                strokeWidth="0.5"
              />
              <circle
                cx={containerSize.width / 2}
                cy={containerSize.height / 2}
                r={Math.min(containerSize.width, containerSize.height) * 0.44}
                fill="none"
                stroke={isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}
                strokeWidth="0.5"
              />
            </>
          )}
        </svg>
      )}

      {/* Items */}
      <div ref={innerRef} className="absolute inset-0">
        {nodesRef.current.map((node, i) => {
          const r = node.resource;
          const isSelected = selectedId === r.id;
          const isHovered = hoveredId === r.id;
          const isConnected = node.relation === 'connected';
          const isSameCategory = node.relation === 'same-category';
          const isDimmed = mode === 'orbit' && node.relation === 'none';
          const hasImage = !!r.imageUrl;

          // Size adjustments based on state
          let scale = 1;
          if (isSelected) scale = isMobile ? 1.8 : 2.2;
          else if (isHovered) scale = 1.3;
          else if (isConnected) scale = 1.1;
          else if (isDimmed) scale = 0.6;

          // Staggered reveal
          const rng = seededRandom(r.id * 13 + i);
          const revealDelay = 50 + rng() * 600;

          return (
            <div
              key={r.id}
              data-orbit-item
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
                className="w-full h-full relative overflow-hidden"
                style={{
                  transform: `scale(${scale})`,
                  transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 0.4s',
                  boxShadow: isSelected
                    ? `0 0 30px 4px ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)'}`
                    : isHovered
                    ? `0 4px 16px ${isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)'}`
                    : 'none',
                  border: 'none',
                }}
              >
                {hasImage ? (
                  <img
                    src={r.imageUrl!}
                    alt={r.title}
                    className="w-full h-full object-contain"
                    loading="lazy"
                    draggable={false}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center p-2"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                    }}
                  >
                    {r.quoteText ? (
                      <p
                        className="text-center leading-tight"
                        style={{
                          fontFamily: "'EB Garamond', serif",
                          fontSize: 10,
                          color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.6)',
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
                          color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)',
                          textAlign: 'center',
                        }}
                      >
                        {r.title}
                      </span>
                    )}
                  </div>
                )}


              </div>

              {/* Title on hover */}
              {(isHovered || isSelected) && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap"
                  style={{
                    top: '100%',
                    marginTop: 6 * scale,
                    zIndex: 300,
                  }}
                >
                  <div
                    className="px-2 py-1 rounded"
                    style={{
                      background: isDarkMode ? 'rgba(10,10,12,0.9)' : 'rgba(255,255,255,0.92)',
                      backdropFilter: 'blur(8px)',
                      border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.1)',
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-[5px] h-[5px] rounded-full shrink-0"
                        style={{ backgroundColor: TYPE_COLORS[r.type] || 'rgba(128,128,128,0.5)' }}
                      />
                      <span className={`text-[10px] max-w-[180px] truncate ${isDarkMode ? 'text-white/80' : 'text-black/80'}`} style={{ fontFamily: "'EB Garamond', serif" }}>
                        {r.title}
                      </span>
                    </div>
                    {r.creator && (
                      <div className={`text-[8px] pl-[11px] ${isDarkMode ? 'text-white/35' : 'text-black/45'}`}>{r.creator}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Ring labels when in orbit mode */}
      {mode === 'orbit' && !isMobile && !isNarrow && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {/* Inner ring label */}
          <div
            className="absolute text-[9px] uppercase tracking-[0.15em]"
            style={{
              left: containerSize.width / 2 + Math.min(containerSize.width, containerSize.height) * 0.18 + 8,
              top: containerSize.height / 2 - 6,
              fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
              color: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)',
            }}
          >
            Connected
          </div>
          {/* Middle ring label */}
          <div
            className="absolute text-[9px] uppercase tracking-[0.15em]"
            style={{
              left: containerSize.width / 2 + Math.min(containerSize.width, containerSize.height) * 0.32 + 8,
              top: containerSize.height / 2 - 6,
              fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
              color: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.2)',
            }}
          >
            Same {GROUPINGS[activeGrouping].label.toLowerCase()}
          </div>
        </div>
      )}

      {/* Grouping switcher (bottom-left) */}
      <div
        className="absolute bottom-4 left-4 flex items-center gap-1 z-30 px-3 py-2 rounded-full"
        style={{
          background: isDarkMode ? 'rgba(20,20,25,0.6)' : 'rgba(240,240,240,0.8)',
          backdropFilter: 'blur(16px)',
          border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
        }}
      >
        {GROUPINGS.slice(0, 3).map((g, gi) => (
          <button
            key={g.id}
            onClick={() => setActiveGrouping(gi)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer"
            style={{
              background: activeGrouping === gi ? (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)') : 'transparent',
            }}
          >
            <span
              className="w-2 h-2 rounded-full transition-all"
              style={{
                backgroundColor: activeGrouping === gi ? (isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)') : 'transparent',
                border: `1.5px solid ${isDarkMode ? `rgba(255,255,255,${activeGrouping === gi ? 0.8 : 0.25})` : `rgba(0,0,0,${activeGrouping === gi ? 0.7 : 0.25})`}`,
              }}
            />
            <span
              className="text-[10px] uppercase tracking-[0.1em]"
              style={{
                fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                color: activeGrouping === gi ? (isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)') : (isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)'),
                fontWeight: activeGrouping === gi ? 500 : 400,
              }}
            >
              {g.label}
            </span>
          </button>
        ))}
      </div>

      {/* Mode indicator & instructions */}
      {!isMobile && !isNarrow && (
        <div className="absolute top-4 right-4 z-30">
          <div
            className="px-3 py-2 rounded-lg"
            style={{
              background: isDarkMode ? 'rgba(20,20,25,0.7)' : 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(12px)',
              border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
            }}
          >
            <div
              className={`text-[9px] uppercase tracking-[0.12em] ${isDarkMode ? 'text-white/40' : 'text-black/50'}`}
              style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace" }}
            >
              {mode === 'scatter' ? 'Constellation' : 'Orbit'}
            </div>
            <div className={`text-[8px] mt-1 ${isDarkMode ? 'text-white/20' : 'text-black/30'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace" }}>
              {mode === 'scatter'
                ? 'Click any image to orbit around it'
                : 'Click center to return · Click another to re-orbit'
              }
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
