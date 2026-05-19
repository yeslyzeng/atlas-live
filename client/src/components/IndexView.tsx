import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { Resource, Connection } from '../types';
import { TYPE_COLORS, CONNECTION_COLORS } from '../types';

interface IndexViewProps {
  resources: Resource[];
  connections: Connection[];
  onSelectResource: (resource: Resource) => void;
}

type SortKey = 'default' | 'creator' | 'title' | 'year' | 'type' | 'alpha';

/**
 * IndexView — project000.xyz-style horizontal-scrolling cards view.
 * Vertical columns of cards that scroll horizontally via drag.
 * Each card: [image] [info grid]. Click to expand.
 * Sort controls top-right, Show controls top-right, Filter panel left.
 */
export default function IndexView({ resources, connections, onSelectResource }: IndexViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [showImages, setShowImages] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Drag scroll state
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);
  const hasDragged = useRef(false);

  // Connection type filters
  const connectionTypes = useMemo(() => {
    const types = new Set<string>();
    connections.forEach(c => types.add(c.type));
    return Array.from(types);
  }, [connections]);

  const [filters, setFilters] = useState<Record<string, boolean>>(() => {
    const f: Record<string, boolean> = {};
    connectionTypes.forEach(t => { f[t] = true; });
    return f;
  });

  useEffect(() => {
    const f: Record<string, boolean> = {};
    connectionTypes.forEach(t => { f[t] = filters[t] ?? true; });
    setFilters(f);
  }, [connectionTypes]);

  const toggleFilter = useCallback((type: string) => {
    setFilters(prev => ({ ...prev, [type]: !prev[type] }));
  }, []);

  // Sorted resources
  const sortedResources = useMemo(() => {
    const arr = [...resources];
    switch (sortKey) {
      case 'creator':
        return arr.sort((a, b) => (a.creator || '').localeCompare(b.creator || ''));
      case 'title':
        return arr.sort((a, b) => a.title.localeCompare(b.title));
      case 'alpha':
        return arr.sort((a, b) => {
          const aFirst = (a.title || '').charAt(0).toUpperCase();
          const bFirst = (b.title || '').charAt(0).toUpperCase();
          return aFirst.localeCompare(bFirst);
        });
      case 'year':
        return arr.sort((a, b) => (a.year || 0) - (b.year || 0));
      case 'type':
        return arr.sort((a, b) => a.type.localeCompare(b.type));
      default:
        return arr;
    }
  }, [resources, sortKey]);

  // Get connection count for a resource (filtered)
  const getConnectionCount = useCallback((resourceId: number) => {
    return connections.filter(c => {
      if (!filters[c.type]) return false;
      return c.sourceId === resourceId || c.targetId === resourceId;
    }).length;
  }, [connections, filters]);

  // Column layout: fill columns vertically, then scroll horizontally
  const CARD_HEIGHT = 120;
  const COLUMN_GAP = 40;
  const CARD_GAP = 20;
  const TOP_PADDING = 85;
  const BOTTOM_PADDING = 20;

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
    if (hasDragged.current) return; // Don't trigger on drag
    if (expandedId === r.id) {
      setExpandedId(null);
    } else {
      setExpandedId(r.id);
      onSelectResource(r);
    }
  }, [expandedId, onSelectResource]);

  // Sort key determines which info row shows first
  const getInfoRows = useCallback((r: Resource) => {
    const allRows = [
      { label: 'Creator', value: r.creator || 'Unknown', key: 'creator' },
      { label: 'Title', value: r.title, key: 'title' },
      { label: 'Year', value: r.year ? String(r.year) : '—', key: 'year' },
      { label: 'Type', value: r.type, key: 'type' },
    ];
    const sk = sortKey === 'default' ? 'creator' : sortKey;
    allRows.sort((a, b) => (b.key === sk ? 1 : 0) - (a.key === sk ? 1 : 0));
    return allRows;
  }, [sortKey]);

  const expandRows = 2.5;
  const expandedHeight = Math.round(expandRows * CARD_HEIGHT + (expandRows - 1) * CARD_GAP);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden" style={{ background: '#0a0a0a' }}>
      {/* Filter Panel — fixed left, vertically centered */}
      <div
        className="fixed z-30 hidden md:flex flex-col"
        style={{
          left: 30,
          top: '46%',
          transform: 'translateY(-50%)',
          padding: '12px 16px',
          fontSize: 13,
          color: '#fff',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0)',
          borderRadius: 0,
          width: 180,
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
        <div style={{ marginBottom: 10, opacity: 0.4 }}>View by</div>
        {connectionTypes.map(type => (
          <label
            key={type}
            className="flex items-center gap-2 cursor-pointer"
            style={{
              opacity: filters[type] ? 1 : 0.4,
              marginBottom: 0,
              fontSize: 13,
              lineHeight: '1.8',
            }}
            onClick={() => toggleFilter(type)}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: CONNECTION_COLORS[type] || '#888' }}
            />
            <span className="capitalize text-white">{type}</span>
          </label>
        ))}
      </div>

      {/* Sort Controls — fixed top-right */}
      <div
        className="fixed z-30 hidden md:flex flex-col"
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
        <div style={{ opacity: 0.4, marginBottom: 6 }}>Sort by</div>
        {(['default', 'creator', 'title', 'year', 'type', 'alpha'] as SortKey[]).map(key => (
          <label
            key={key}
            className="block cursor-pointer capitalize"
            style={{ opacity: sortKey === key ? 1 : 0.4, marginBottom: 0, lineHeight: '1.8' }}
            onClick={() => setSortKey(key)}
          >
            <input
              type="radio"
              name="sort-option"
              value={key}
              checked={sortKey === key}
              onChange={() => setSortKey(key)}
              className="sr-only"
            />
            {key}
          </label>
        ))}
      </div>

      {/* Show Controls — fixed top-right, below sort */}
      <div
        className="fixed z-30 hidden md:flex flex-col"
        style={{
          top: 220,
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
        <div style={{ opacity: 0.4, marginBottom: 6 }}>Show</div>
        <label
          className="block cursor-pointer"
          style={{ opacity: showImages ? 1 : 0.4, lineHeight: '1.8' }}
          onClick={() => setShowImages(!showImages)}
        >
          Image
        </label>
        <label
          className="block cursor-pointer"
          style={{ opacity: showInfo ? 1 : 0.4, lineHeight: '1.8' }}
          onClick={() => setShowInfo(!showInfo)}
        >
          Info
        </label>
      </div>

      {/* Cards Container — horizontal scroll via drag */}
      <div
        ref={cardsRef}
        className="absolute inset-0 overflow-x-auto overflow-y-auto cursor-grab select-none"
        style={{
          paddingTop: TOP_PADDING,
          paddingBottom: BOTTOM_PADDING,
          paddingLeft: 40,
          paddingRight: 40,
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex" style={{ gap: COLUMN_GAP, height: '100%', alignItems: 'flex-start' }}>
          {columnData.map((col, colIdx) => (
            <div
              key={colIdx}
              className="flex flex-col shrink-0"
              style={{ gap: CARD_GAP, width: 'max-content' }}
            >
              {col.map((resource) => {
                const isExpanded = expandedId === resource.id;
                const connCount = getConnectionCount(resource.id);
                const infoRows = getInfoRows(resource);

                return (
                  <div
                    key={resource.id}
                    className="flex gap-3 overflow-visible transition-all"
                    style={{
                      height: isExpanded ? expandedHeight : CARD_HEIGHT,
                      cursor: 'pointer',
                      transitionDuration: '350ms',
                      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                      alignItems: 'flex-start',
                    }}
                    onClick={() => handleCardClick(resource)}
                    onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.opacity = '0.7'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                  >
                    {/* Image */}
                    {showImages && resource.imageUrl && (
                      <div className="shrink-0" style={{ width: isExpanded ? 'auto' : 120, marginRight: 16 }}>
                        <img
                          src={resource.imageUrl}
                          alt={resource.title}
                          className="object-contain transition-all"
                          style={{
                            height: isExpanded ? expandedHeight : CARD_HEIGHT,
                            maxHeight: isExpanded ? 'none' : CARD_HEIGHT,
                            maxWidth: isExpanded ? 400 : 120,
                            width: isExpanded ? 'auto' : 120,
                            transitionDuration: '350ms',
                            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                            alignSelf: 'flex-start',
                          }}
                          loading="lazy"
                          draggable={false}
                        />
                      </div>
                    )}

                    {/* Info Grid */}
                    {showInfo && (
                      <div className="shrink-0 pt-1" style={{ width: 250, marginRight: 30 }}>
                        <div className="grid" style={{ rowGap: 0 }}>
                          {infoRows.map(row => (
                            <div key={row.key} className="grid" style={{ gridTemplateColumns: '70px auto', alignItems: 'start', fontSize: 14, height: 'auto' }}>
                              <div style={{ color: 'rgba(255,255,255,0.44)' }}>{row.label}</div>
                              <div className="text-white">{row.value}</div>
                            </div>
                          ))}
                        </div>

                        {/* Connection count */}
                        {connCount > 0 && (
                          <div className="mt-2" style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                            {connCount}↗
                          </div>
                        )}
                      </div>
                    )}

                    {/* Minimal mode */}
                    {!showImages && !showInfo && (
                      <div className="pt-1">
                        <span className="text-white/60 text-sm">{resource.title}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile controls overlay */}
      <div className="md:hidden fixed bottom-20 left-4 right-4 z-30 flex gap-2">
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="flex-1 bg-black/80 text-white text-xs border border-white/10 rounded px-2 py-1.5 backdrop-blur-sm"
        >
          <option value="default">Default</option>
          <option value="creator">Creator</option>
          <option value="title">Title</option>
          <option value="year">Year</option>
          <option value="type">Type</option>
          <option value="alpha">A-Z</option>
        </select>
        <button
          onClick={() => setShowImages(!showImages)}
          className={`px-2 py-1.5 text-xs rounded border backdrop-blur-sm ${showImages ? 'bg-white/10 border-white/20 text-white' : 'bg-black/80 border-white/10 text-white/40'}`}
        >
          Img
        </button>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className={`px-2 py-1.5 text-xs rounded border backdrop-blur-sm ${showInfo ? 'bg-white/10 border-white/20 text-white' : 'bg-black/80 border-white/10 text-white/40'}`}
        >
          Info
        </button>
      </div>
    </div>
  );
}
