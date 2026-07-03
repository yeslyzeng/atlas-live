import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import type { Resource } from '../types';

interface GridViewProps {
  resources: Resource[];
  onSelectResource: (r: Resource) => void;
  isDarkMode?: boolean;
}

/**
 * Infinite Grid View — Seth Thompson periodic space style.
 * 2D infinite scrolling grid where images tile infinitely via modulo wrapping.
 * Drag or scroll in any direction to explore.
 */

// Euclidean modulo
const mod = (x: number, n: number) => ((x % n) + n) % n;

export default function GridView({ resources, onSelectResource, isDarkMode = true }: GridViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Pan position (top-left corner in virtual space)
  const panX = useRef(0);
  const panY = useRef(0);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const panStartX = useRef(0);
  const panStartY = useRef(0);
  const [, forceRender] = useState(0);

  // Grid cell sizing
  const CELL_SIZE = 160;
  const GAP = 4;
  const CELL_TOTAL = CELL_SIZE + GAP;

  // Only resources with images for the grid
  const imageResources = useMemo(() => resources.filter(r => r.imageUrl), [resources]);
  const N = imageResources.length;

  // Compute grid dimensions (how many cols/rows to tile)
  const cols = useMemo(() => N > 0 ? Math.ceil(Math.sqrt(N)) : 1, [N]);
  const rows = useMemo(() => N > 0 ? Math.ceil(N / cols) : 1, [N, cols]);

  // Period sizes in pixels
  const periodX = cols * CELL_TOTAL;
  const periodY = rows * CELL_TOTAL;

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

  // Wheel handler — pan in any direction
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      panX.current += e.deltaX || e.deltaY;
      panY.current += e.deltaY;
      forceRender(n => n + 1);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    panStartX.current = panX.current;
    panStartY.current = panY.current;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      panX.current = panStartX.current - (e.clientX - dragStartX.current);
      panY.current = panStartY.current - (e.clientY - dragStartY.current);
      forceRender(n => n + 1);
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Compute visible cells
  const visibleCells = useMemo(() => {
    if (!containerSize.width || !containerSize.height || N === 0) return [];

    const vw = containerSize.width;
    const vh = containerSize.height;

    // How many cells fit in viewport + overscan
    const overscan = 2;
    const visibleCols = Math.ceil(vw / CELL_TOTAL) + overscan * 2;
    const visibleRows = Math.ceil(vh / CELL_TOTAL) + overscan * 2;

    // Starting cell index based on pan
    const startCol = Math.floor(panX.current / CELL_TOTAL) - overscan;
    const startRow = Math.floor(panY.current / CELL_TOTAL) - overscan;

    const cells: { resource: Resource; x: number; y: number; key: string }[] = [];

    for (let row = 0; row < visibleRows; row++) {
      for (let col = 0; col < visibleCols; col++) {
        const gridCol = startCol + col;
        const gridRow = startRow + row;

        // Map to resource index using periodic boundary
        const wrappedCol = mod(gridCol, cols);
        const wrappedRow = mod(gridRow, rows);
        const resourceIdx = mod(wrappedRow * cols + wrappedCol, N);

        // Position on screen
        const screenX = gridCol * CELL_TOTAL - panX.current;
        const screenY = gridRow * CELL_TOTAL - panY.current;

        cells.push({
          resource: imageResources[resourceIdx],
          x: screenX,
          y: screenY,
          key: `${gridCol},${gridRow}`,
        });
      }
    }

    return cells;
  }, [containerSize, panX.current, panY.current, N, imageResources, cols, rows, CELL_TOTAL]);

  const [hoveredId, setHoveredId] = useState<number | null>(null);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden cursor-grab"
      style={{ background: isDarkMode ? '#1a1a1a' : '#f5f5f5' }}
      onMouseDown={handleMouseDown}
    >
      {visibleCells.map(cell => {
        const isHovered = hoveredId === cell.resource.id;
        return (
          <div
            key={cell.key}
            className="absolute"
            style={{
              left: cell.x,
              top: cell.y,
              width: CELL_SIZE,
              height: CELL_SIZE,
              transition: 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.3s',
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              zIndex: isHovered ? 10 : 1,
              opacity: isHovered ? 1 : 0.9,
            }}
            onMouseEnter={() => setHoveredId(cell.resource.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => {
              if (!isDragging.current) onSelectResource(cell.resource);
            }}
          >
            <img
              src={cell.resource.imageUrl!}
              alt={cell.resource.title}
              className="w-full h-full object-cover"
              loading="lazy"
              draggable={false}
            />
            {/* Hover overlay */}
            {isHovered && (
              <div
                className="absolute inset-x-0 bottom-0 p-2"
                style={{
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                }}
              >
                <div className="text-[11px] text-white/90 truncate" style={{ fontFamily: "'SF Mono', monospace" }}>
                  {cell.resource.title}
                </div>
                {cell.resource.creator && (
                  <div className="text-[9px] text-white/50 truncate">
                    {cell.resource.creator}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Subtle crosshair at center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
        <div style={{
          width: 20,
          height: 20,
          border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          borderRadius: '50%',
        }} />
      </div>
    </div>
  );
}
