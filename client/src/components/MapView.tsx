import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import type { Resource, Connection } from '../types';
import { TYPE_COLORS, CONNECTION_COLORS } from '../types';
import { useIsMobile } from '@/hooks/useIsMobile';

interface MapViewProps {
  resources: Resource[];
  connections: Connection[];
  onSelectResource: (r: Resource) => void;
  isDarkMode?: boolean;
}

/**
 * MapView — project000.xyz Map mode replica.
 * 
 * Images positioned in a spiral pattern on an infinite canvas.
 * Connection lines drawn on a canvas layer between related resources.
 * Pan with drag, zoom with scroll wheel (centered on cursor).
 * Click to expand/select, hover to highlight connections.
 * Filter connections by type (category, colour, theme, creator).
 */
export default function MapView({ resources, connections, onSelectResource, isDarkMode = true }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Pan & zoom state
  const panX = useRef(0);
  const panY = useRef(0);
  const zoom = useRef(1);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const hasDragged = useRef(false);

  // UI state
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [filterEnabled, setFilterEnabled] = useState<Record<string, boolean>>({
    type: true,
    colour: true,
    theme: true,
    creator: true,
  });
  const [, forceRender] = useState(0);

  // Only resources with images
  const imageResources = useMemo(() => resources.filter(r => r.imageUrl), [resources]);

  // Position nodes in a spiral (like project000)
  const nodePositions = useMemo(() => {
    return imageResources.map((r, index) => {
      const angle = (index / imageResources.length) * Math.PI * 2 * 8;
      const baseRadius = 250 + (index * 30);
      const radius = baseRadius + (Math.sin(index * 0.7) * 300);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const aspectRatio = r.aspectRatio ? parseFloat(r.aspectRatio) : 1;
      const baseWidth = 200;
      const baseHeight = baseWidth * aspectRatio;
      return { resource: r, x, y, baseWidth, baseHeight };
    });
  }, [imageResources]);

  // Render connections on canvas
  const renderConnections = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    connections.forEach(conn => {
      if (!filterEnabled[conn.type]) return;

      const sourceNode = nodePositions.find(n => n.resource.id === conn.sourceId);
      const targetNode = nodePositions.find(n => n.resource.id === conn.targetId);
      if (!sourceNode || !targetNode) return;

      const sx = (sourceNode.x + panX.current) * zoom.current + cx;
      const sy = (sourceNode.y + panY.current) * zoom.current + cy;
      const tx = (targetNode.x + panX.current) * zoom.current + cx;
      const ty = (targetNode.y + panY.current) * zoom.current + cy;

      // Cull off-screen lines
      if (sx < -100 && tx < -100) return;
      if (sx > canvas.width + 100 && tx > canvas.width + 100) return;
      if (sy < -100 && ty < -100) return;
      if (sy > canvas.height + 100 && ty > canvas.height + 100) return;

      // Highlight connections to expanded/hovered node
      const isActive = expandedId !== null && (conn.sourceId === expandedId || conn.targetId === expandedId);
      const isHoveredConn = hoveredId !== null && (conn.sourceId === hoveredId || conn.targetId === hoveredId);

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = conn.color || CONNECTION_COLORS[conn.type] || 'rgba(255,255,255,0.1)';
      ctx.globalAlpha = isActive ? 0.6 : isHoveredConn ? 0.3 : 0.08;
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.stroke();
    });

    ctx.globalAlpha = 1;
  }, [connections, nodePositions, filterEnabled, expandedId, hoveredId]);

  // Update node positions and redraw
  const updateView = useCallback(() => {
    const nodes = nodesRef.current;
    if (!nodes) return;

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    const children = nodes.children;
    nodePositions.forEach((node, i) => {
      const el = children[i] as HTMLElement;
      if (!el) return;
      const screenX = (node.x + panX.current) * zoom.current + cx;
      const screenY = (node.y + panY.current) * zoom.current + cy;
      const w = node.baseWidth * zoom.current;
      const h = node.baseHeight * zoom.current;
      el.style.transform = `translate(${screenX - w / 2}px, ${screenY - h / 2}px)`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
    });

    renderConnections();
  }, [nodePositions, renderConnections]);

  // Initial render + animation frame for smooth updates
  useEffect(() => {
    updateView();
  }, [updateView, filterEnabled, expandedId, hoveredId]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== containerRef.current && e.target !== canvasRef.current) return;
    isDragging.current = true;
    hasDragged.current = false;
    dragStartX.current = e.clientX - panX.current * zoom.current;
    dragStartY.current = e.clientY - panY.current * zoom.current;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      hasDragged.current = true;
      panX.current = (e.clientX - dragStartX.current) / zoom.current;
      panY.current = (e.clientY - dragStartY.current) / zoom.current;
      updateView();
    };
    const handleMouseUp = () => {
      isDragging.current = false;
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [updateView]);

  // Zoom (centered on cursor)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 1.05;
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - window.innerWidth / 2;
      const mouseY = e.clientY - rect.top - window.innerHeight / 2;

      const oldZoom = zoom.current;
      if (e.deltaY < 0) {
        zoom.current = Math.min(5, zoom.current * zoomFactor);
      } else {
        zoom.current = Math.max(0.1, zoom.current / zoomFactor);
      }

      // Adjust pan to zoom toward cursor
      const zoomRatio = zoom.current / oldZoom;
      panX.current = panX.current - (mouseX / oldZoom) * (1 - 1 / zoomRatio);
      panY.current = panY.current - (mouseY / oldZoom) * (1 - 1 / zoomRatio);

      updateView();
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [updateView]);

  // Click handler
  const handleNodeClick = useCallback((r: Resource) => {
    if (hasDragged.current) return;
    if (expandedId === r.id) {
      setExpandedId(null);
    } else {
      setExpandedId(r.id);
      onSelectResource(r);
    }
  }, [expandedId, onSelectResource]);

  const toggleFilter = (key: string) => {
    setFilterEnabled(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const textColor = isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden cursor-grab"
      style={{ background: isDarkMode ? '#1a1a1a' : '#f5f5f5' }}
      onMouseDown={handleMouseDown}
    >
      {/* Connection lines canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-0"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Nodes container */}
      <div ref={nodesRef} className="absolute inset-0 pointer-events-none z-10">
        {nodePositions.map(node => {
          const r = node.resource;
          const isExpanded = expandedId === r.id;
          const isHovered = hoveredId === r.id;

          return (
            <div
              key={r.id}
              className="absolute pointer-events-auto"
              style={{
                transformOrigin: 'center center',
                opacity: isExpanded ? 1 : isHovered ? 0.7 : 0.4,
                transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                zIndex: isExpanded ? 100 : isHovered ? 50 : 1,
                cursor: 'pointer',
              }}
              onMouseEnter={() => setHoveredId(r.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleNodeClick(r)}
            >
              <img
                src={r.imageUrl!}
                alt={r.title}
                className="w-full h-full object-contain"
                draggable={false}
              />
            </div>
          );
        })}
      </div>

      {/* Filter panel — left side */}
      <div
        className="fixed z-30 hidden md:flex flex-col"
        style={{
          left: 30,
          top: '46%',
          transform: 'translateY(-50%)',
          padding: '12px 16px',
          fontSize: 13,
          color: textColor,
          backdropFilter: 'blur(8px)',
          border: '1px solid transparent',
          transition: 'all 0.2s',
          width: 180,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.border = isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)';
          e.currentTarget.style.background = isDarkMode ? 'rgba(26,26,26,0.8)' : 'rgba(255,255,255,0.8)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.border = '1px solid transparent';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <div style={{ marginBottom: 10, opacity: 0.4 }}>View by</div>
        {Object.entries(CONNECTION_COLORS).map(([type, color]) => (
          <label
            key={type}
            className="flex items-center gap-2 cursor-pointer"
            style={{
              opacity: filterEnabled[type] ? 1 : 0.4,
              fontSize: 13,
              lineHeight: '1.8',
            }}
            onClick={() => toggleFilter(type)}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="capitalize">{type}</span>
          </label>
        ))}
      </div>

      {/* Info panel for expanded node */}
      {expandedId && (() => {
        const r = imageResources.find(res => res.id === expandedId);
        if (!r) return null;
        return (
          <div
            className="fixed z-40 hidden md:block"
            style={{
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '12px 20px',
              background: isDarkMode ? 'rgba(20,20,22,0.9)' : 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(12px)',
              border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
              borderRadius: 8,
              maxWidth: 400,
            }}
          >
            <div style={{ fontSize: 14, color: isDarkMode ? '#fff' : '#000', fontWeight: 500 }}>{r.title}</div>
            <div style={{ fontSize: 12, color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', marginTop: 2 }}>
              {r.creator && `${r.creator}`}
              {r.creator && r.year && ' · '}
              {r.year && `${r.year}`}
              {(r.creator || r.year) && r.type && ' · '}
              {r.type}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
