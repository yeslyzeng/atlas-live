import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { Resource, Connection } from '../types';
import { ExternalLink } from 'lucide-react';

interface IndexViewProps {
  resources: Resource[];
  connections: Connection[];
  onSelectResource: (r: Resource) => void;
}

type SortKey = 'default' | 'creator' | 'title' | 'year' | 'type';

/**
 * IndexView — project000.xyz-style horizontal-scrolling cards view.
 * Vertical columns of cards that scroll horizontally via wheel/drag.
 * Each card: [image] [info grid]. Click to expand.
 */
export default function IndexView({ resources, connections, onSelectResource }: IndexViewProps) {
  const cardsRef = useRef<HTMLDivElement>(null);
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [showImages, setShowImages] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Scroll position via translateX (like project000)
  const scrollX = useRef(0);
  const maxScroll = useRef(0);
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

  // Layout constants (matching project000)
  const CARD_HEIGHT = 120;
  const COLUMN_GAP = 40;
  const CARD_GAP = 20;
  const TOP_PADDING = 85;
  const BOTTOM_PADDING = 80;
  const IMG_WIDTH = 120;
  const INFO_WIDTH = 250;

  const cardsPerColumn = useMemo(() => {
    const availableHeight = (typeof window !== 'undefined' ? window.innerHeight : 800) - TOP_PADDING - BOTTOM_PADDING;
    return Math.max(1, Math.floor(availableHeight / (CARD_HEIGHT + CARD_GAP)));
  }, []);

  const expandRows = cardsPerColumn >= 3 ? 3 : 2;
  const expandedImgSize = expandRows * CARD_HEIGHT + (expandRows - 1) * CARD_GAP;

  // Relayout columns accounting for expanded card taking multiple slots
  const columnData = useMemo(() => {
    const cols: Resource[][] = [];
    let currentCol: Resource[] = [];
    let slotsUsed = 0;

    sortedResources.forEach((r) => {
      const slots = (expandedId === r.id) ? expandRows : 1;
      if (slotsUsed + slots > cardsPerColumn && currentCol.length > 0) {
        cols.push(currentCol);
        currentCol = [];
        slotsUsed = 0;
      }
      currentCol.push(r);
      slotsUsed += slots;
      if (slotsUsed >= cardsPerColumn) {
        cols.push(currentCol);
        currentCol = [];
        slotsUsed = 0;
      }
    });
    if (currentCol.length > 0) cols.push(currentCol);
    return cols;
  }, [sortedResources, cardsPerColumn, expandedId, expandRows]);

  // Wheel scroll → translateX (like project000)
  useEffect(() => {
    const el = cardsRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      scrollX.current -= e.deltaY;
      scrollX.current = Math.min(0, scrollX.current);
      const totalWidth = el.scrollWidth;
      maxScroll.current = Math.max(0, totalWidth - window.innerWidth);
      scrollX.current = Math.max(-maxScroll.current, scrollX.current);
      el.style.transform = `translateX(${scrollX.current}px)`;
    };
    // Need to attach to parent for wheel capture
    const parent = el.parentElement;
    if (parent) {
      parent.addEventListener('wheel', handleWheel, { passive: false });
      return () => parent.removeEventListener('wheel', handleWheel);
    }
  }, [columnData]);

  // Drag scroll
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    hasDragged.current = false;
    dragStartX.current = e.clientX;
    scrollStartX.current = scrollX.current;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStartX.current;
      if (Math.abs(dx) > 3) hasDragged.current = true;
      const el = cardsRef.current;
      if (!el) return;
      let newX = scrollStartX.current + dx;
      newX = Math.min(0, newX);
      const totalWidth = el.scrollWidth;
      maxScroll.current = Math.max(0, totalWidth - window.innerWidth);
      newX = Math.max(-maxScroll.current, newX);
      scrollX.current = newX;
      el.style.transform = `translateX(${scrollX.current}px)`;
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
    if (expandedId === r.id) {
      setExpandedId(null);
    } else {
      setExpandedId(r.id);
      onSelectResource(r);
    }
  }, [expandedId, onSelectResource]);

  // Info rows sorted by current sort key (like project000)
  const getInfoRows = useCallback((r: Resource) => {
    const allRows = [
      { label: 'Creator', value: r.creator || 'Unknown', key: 'creator' },
      { label: 'Title', value: r.title, key: 'title' },
      { label: 'Year', value: r.year ? String(r.year) : '—', key: 'year' },
      { label: 'Medium', value: r.type, key: 'type' },
    ];
    const sk = sortKey === 'default' ? 'creator' : sortKey;
    allRows.sort((a, b) => (b.key === sk ? 1 : 0) - (a.key === sk ? 1 : 0));
    return allRows;
  }, [sortKey]);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#1a1a1a', userSelect: 'none' }}>
      {/* Cards container — translateX based scroll */}
      <div
        className="absolute inset-0 overflow-hidden cursor-grab"
        onMouseDown={handleMouseDown}
      >
        <div
          ref={cardsRef}
          className="flex flex-row items-start"
          style={{
            padding: `${TOP_PADDING}px 40px ${BOTTOM_PADDING}px 40px`,
            height: '100%',
            transition: 'none',
          }}
        >
          {columnData.map((col, colIdx) => (
            <div
              key={colIdx}
              className="flex flex-col shrink-0"
              style={{ marginRight: COLUMN_GAP, gap: CARD_GAP, overflow: 'hidden' }}
            >
              {col.map((resource) => {
                const isExpanded = expandedId === resource.id;
                const infoRows = getInfoRows(resource);

                return (
                  <div
                    key={resource.id}
                    className="flex overflow-hidden"
                    style={{
                      height: isExpanded ? expandedImgSize : CARD_HEIGHT,
                      gap: 12,
                      transition: 'height 0.5s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.4s ease-out',
                      opacity: 1,
                      cursor: 'pointer',
                      alignItems: 'flex-start',
                    }}
                    onClick={() => handleCardClick(resource)}
                    onMouseEnter={(e) => { if (!isExpanded) (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                  >
                    {/* Image */}
                    {showImages && resource.imageUrl && (
                      <div className="shrink-0" style={{ width: isExpanded ? 'auto' : IMG_WIDTH, marginRight: 16 }}>
                        <img
                          src={resource.imageUrl}
                          alt={resource.title}
                          className="object-contain"
                          style={{
                            height: isExpanded ? expandedImgSize : CARD_HEIGHT,
                            maxHeight: isExpanded ? 'none' : CARD_HEIGHT,
                            maxWidth: isExpanded ? 'none' : IMG_WIDTH,
                            width: isExpanded ? 'auto' : IMG_WIDTH,
                            transition: 'height 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
                            alignSelf: 'flex-start',
                          }}
                          loading="lazy"
                          draggable={false}
                        />
                      </div>
                    )}

                    {/* Info Grid */}
                    {showInfo && (
                      <div className="shrink-0 pt-1" style={{ width: INFO_WIDTH, marginRight: 30, alignSelf: 'flex-start' }}>
                        <div className="grid" style={{ rowGap: 4 }}>
                          {infoRows.map(row => (
                            <div key={row.key} className="grid" style={{ gridTemplateColumns: '70px auto', alignItems: 'baseline', fontSize: 13, lineHeight: '1.4' }}>
                              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{row.label}</div>
                              <div style={{ color: '#fff', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{row.value}</div>
                            </div>
                          ))}
                          {/* Link row */}
                          {resource.url && (
                            <div className="grid" style={{ gridTemplateColumns: '70px auto', alignItems: 'baseline', fontSize: 13, lineHeight: '1.4' }}>
                              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Link</div>
                              <a
                                href={resource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 hover:opacity-100 transition-opacity"
                                style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, opacity: 0.7 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Minimal mode */}
                    {!showImages && !showInfo && (
                      <div className="pt-1">
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{resource.title}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Sort controls — top right (like project000) */}
      <div
        className="fixed z-30 hidden md:flex flex-row gap-3.5"
        style={{
          top: 24,
          right: 30,
          padding: '10px 14px',
          fontSize: 13,
          color: '#fff',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
          e.currentTarget.style.background = 'rgba(26,26,26,0.8)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.border = '1px solid rgba(255,255,255,0)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        {(['default', 'creator', 'title', 'year', 'type'] as SortKey[]).map(key => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className="capitalize transition-opacity"
            style={{ opacity: sortKey === key ? 1 : 0.4 }}
          >
            {key === 'type' ? 'Medium' : key}
          </button>
        ))}
      </div>

      {/* Show controls — top left (like project000) */}
      <div
        className="fixed z-30 hidden md:flex flex-row gap-3.5"
        style={{
          top: 24,
          left: 30,
          padding: '10px 14px',
          fontSize: 13,
          color: '#fff',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
          e.currentTarget.style.background = 'rgba(26,26,26,0.8)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.border = '1px solid rgba(255,255,255,0)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <button
          onClick={() => setShowImages(!showImages)}
          className="transition-opacity"
          style={{ opacity: showImages ? 1 : 0.4 }}
        >
          Image
        </button>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="transition-opacity"
          style={{ opacity: showInfo ? 1 : 0.4 }}
        >
          Info
        </button>
      </div>

      {/* Mobile controls */}
      <div className="md:hidden fixed top-3 left-3 right-3 z-30 flex gap-2 items-center" style={{ fontSize: 11 }}>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="bg-black/80 text-white text-xs border border-white/10 rounded px-2 py-1.5 backdrop-blur-sm"
        >
          <option value="default">Default</option>
          <option value="creator">Creator</option>
          <option value="title">Title</option>
          <option value="year">Year</option>
          <option value="type">Medium</option>
        </select>
        <button
          onClick={() => setShowImages(!showImages)}
          className="transition-opacity px-2 py-1 text-xs text-white/70"
          style={{ opacity: showImages ? 1 : 0.4 }}
        >
          Img
        </button>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="transition-opacity px-2 py-1 text-xs text-white/70"
          style={{ opacity: showInfo ? 1 : 0.4 }}
        >
          Info
        </button>
      </div>
    </div>
  );
}
