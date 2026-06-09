import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { Resource, Connection } from '../types';
import { TYPE_COLORS } from '../types';
import { ExternalLink } from 'lucide-react';

interface IndexViewProps {
  resources: Resource[];
  connections: Connection[];
  onSelectResource: (r: Resource) => void;
}

type SortKey = 'default' | 'creator' | 'title' | 'year' | 'type';

/**
 * IndexView — project000.xyz-inspired horizontal-scrolling card grid.
 * Vertical columns of cards that scroll horizontally via drag.
 * Each card shows image + info (Creator, Title, Year, Medium, Link).
 * Smooth drag-to-scroll interaction.
 */
export default function IndexView({ resources, connections, onSelectResource }: IndexViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [showImages, setShowImages] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // Drag scroll state
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);
  const hasDragged = useRef(false);

  // Sorted resources
  const sortedResources = useMemo(() => {
    const arr = [...resources];
    switch (sortKey) {
      case 'creator':
        return arr.sort((a, b) => (a.creator || '').localeCompare(b.creator || ''));
      case 'title':
        return arr.sort((a, b) => a.title.localeCompare(b.title));
      case 'year':
        return arr.sort((a, b) => (a.year || 0) - (b.year || 0));
      case 'type':
        return arr.sort((a, b) => a.type.localeCompare(b.type));
      default:
        return arr;
    }
  }, [resources, sortKey]);

  // Column layout
  const CARD_HEIGHT = 260;
  const COLUMN_GAP = 2;
  const CARD_GAP = 2;
  const TOP_PADDING = 10;
  const BOTTOM_PADDING = 80;

  const cardsPerColumn = useMemo(() => {
    const availableHeight = (typeof window !== 'undefined' ? window.innerHeight : 800) - TOP_PADDING - BOTTOM_PADDING;
    return Math.max(1, Math.floor((availableHeight + CARD_GAP) / (CARD_HEIGHT + CARD_GAP)));
  }, []);

  const columnData = useMemo(() => {
    const cols: Resource[][] = [];
    let currentCol: Resource[] = [];
    sortedResources.forEach((r) => {
      currentCol.push(r);
      if (currentCol.length >= cardsPerColumn) {
        cols.push(currentCol);
        currentCol = [];
      }
    });
    if (currentCol.length > 0) cols.push(currentCol);
    return cols;
  }, [sortedResources, cardsPerColumn]);

  // Drag to scroll horizontally
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    hasDragged.current = false;
    dragStartX.current = e.clientX;
    scrollStartX.current = cardsRef.current?.scrollLeft || 0;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStartX.current;
      if (Math.abs(dx) > 3) hasDragged.current = true;
      if (cardsRef.current) {
        cardsRef.current.scrollLeft = scrollStartX.current - dx;
      }
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

  const handleCardClick = useCallback((r: Resource) => {
    if (hasDragged.current) return;
    onSelectResource(r);
  }, [onSelectResource]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden" style={{ background: '#0a0a0a' }}>
      {/* Cards Container — horizontal scroll via drag */}
      <div
        ref={cardsRef}
        className="absolute inset-0 overflow-x-auto overflow-y-hidden cursor-grab select-none"
        style={{
          paddingTop: TOP_PADDING,
          paddingBottom: BOTTOM_PADDING,
          paddingLeft: 10,
          paddingRight: 10,
          scrollBehavior: 'auto',
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex h-full" style={{ gap: COLUMN_GAP, alignItems: 'flex-start' }}>
          {columnData.map((col, colIdx) => (
            <div
              key={colIdx}
              className="flex flex-col shrink-0"
              style={{ gap: CARD_GAP }}
            >
              {col.map((resource) => {
                const isHovered = hoveredId === resource.id;

                return (
                  <div
                    key={resource.id}
                    className="relative overflow-hidden transition-opacity duration-200"
                    style={{
                      height: CARD_HEIGHT,
                      width: showImages ? 200 : 200,
                      opacity: isHovered ? 1 : 0.85,
                    }}
                    onMouseEnter={() => setHoveredId(resource.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => handleCardClick(resource)}
                  >
                    {/* Image */}
                    {showImages && resource.imageUrl && (
                      <img
                        src={resource.imageUrl}
                        alt={resource.title}
                        className="w-full object-cover"
                        style={{
                          height: showInfo ? 140 : CARD_HEIGHT,
                          display: 'block',
                        }}
                        loading="lazy"
                        draggable={false}
                      />
                    )}

                    {/* Info */}
                    {showInfo && (
                      <div
                        className="px-2 pt-2 pb-1"
                        style={{ fontSize: 11, lineHeight: '1.5', color: 'rgba(255,255,255,0.7)' }}
                      >
                        <div className="truncate" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
                          {resource.creator || 'Unknown'}
                        </div>
                        <div className="truncate font-medium" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12 }}>
                          {resource.title}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5" style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                          <span>{resource.year || '—'}</span>
                          <span className="capitalize">{resource.type}</span>
                          {resource.url && (
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 hover:text-white/70 transition-colors"
                              style={{ color: 'rgba(255,255,255,0.35)' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={9} />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Controls — bottom-left */}
      <div
        className="fixed bottom-20 left-4 z-30 flex flex-col gap-2"
        style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}
      >
        {/* Sort */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sort</span>
          {(['default', 'creator', 'title', 'year', 'type'] as SortKey[]).map(key => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className="capitalize transition-opacity"
              style={{
                opacity: sortKey === key ? 1 : 0.4,
                fontSize: 11,
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              {key}
            </button>
          ))}
        </div>
        {/* Show */}
        <div className="flex gap-3">
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Show</span>
          <button
            onClick={() => setShowImages(!showImages)}
            className="transition-opacity"
            style={{ opacity: showImages ? 1 : 0.4, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}
          >
            Image
          </button>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="transition-opacity"
            style={{ opacity: showInfo ? 1 : 0.4, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}
          >
            Info
          </button>
        </div>
      </div>

      {/* Count — bottom-right */}
      <div
        className="fixed bottom-20 right-4 z-30"
        style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}
      >
        {resources.length} entries
      </div>
    </div>
  );
}
