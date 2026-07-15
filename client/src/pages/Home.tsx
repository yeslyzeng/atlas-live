import { useState } from "react";
import type { Resource, ViewMode } from "../types";
import { useResources } from "../data/useResources";
import OrbitView from "@/components/OrbitView";
import IndexView from "@/components/IndexView";
import GridView from "@/components/GridView";
import ExploreView from "@/components/ExploreView";
import InfoPanel from "@/components/InfoPanel";
import { Search, X, Orbit, List, Grid3X3, Globe2, Sun, Moon } from "lucide-react";
import { useIsMobile, useIsNarrow } from "@/hooks/useIsMobile";

export default function Home() {
  const isMobile = useIsMobile();
  const isNarrow = useIsNarrow();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    if (v && ['orbit', 'index', 'grid', 'explore'].includes(v)) {
      return v as ViewMode;
    }
    return 'orbit';
  });

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const { resources, connections, isLoading } = useResources();

  const handleSelectResource = (r: Resource) => {
    setSelectedResource(r);
  };

  const handleNavigateToResource = (r: Resource) => {
    setSelectedResource(r);
  };

  const views: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: 'orbit', label: 'Orbit', icon: <Orbit size={isMobile ? 18 : 14} /> },
    { key: 'grid', label: 'Grid', icon: <Grid3X3 size={isMobile ? 18 : 14} /> },
    { key: 'explore', label: 'Explore', icon: <Globe2 size={isMobile ? 18 : 14} /> },
    { key: 'index', label: 'Index', icon: <List size={isMobile ? 18 : 14} /> },
  ];

  const activeViewLabel = views.find(v => v.key === viewMode)?.label ?? 'Orbit';

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white/40 text-sm tracking-widest uppercase animate-pulse">
          Loading atlas...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0" style={{ background: isDarkMode ? '#1a1a1a' : '#ffffff', overflow: 'hidden' }}>
      {/* Main view area */}
      {viewMode !== 'grid' && (
        <div
          className="absolute inset-0 transition-all duration-300"
          style={{
            filter: (isMobile && selectedResource) ? 'blur(12px) brightness(0.4)' : 'none',
            transform: (isMobile && selectedResource) ? 'scale(1.02)' : 'none',
            pointerEvents: (isMobile && selectedResource) ? 'none' : 'auto',
            overflow: 'hidden',
          }}
        >
          {viewMode === 'orbit' && (
            <OrbitView
              resources={resources}
              connections={connections}
              onSelectResource={handleSelectResource}
              isDarkMode={isDarkMode}
            />
          )}
          {viewMode === 'index' && (
            <IndexView
              resources={resources}
              connections={connections}
              onSelectResource={handleSelectResource}
            />
          )}
          {viewMode === 'explore' && (
            <ExploreView
              resources={resources}
              onSelectResource={handleSelectResource}
              isDarkMode={isDarkMode}
            />
          )}
        </div>
      )}
      {viewMode === 'grid' && (
        <div className="absolute inset-0 overflow-y-auto">
          <GridView
            resources={resources}
            onSelectResource={handleSelectResource}
            isDarkMode={isDarkMode}
          />
        </div>
      )}

      {/* ─── MOBILE BOTTOM TAB BAR ─── */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center transition-all duration-300"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 12px)',
            paddingTop: 10,
            pointerEvents: 'none',
            opacity: selectedResource ? 0 : 1,
          }}
        >
          <div className="flex items-center" style={{
            pointerEvents: 'auto',
            background: isDarkMode ? 'rgba(160,160,160,0.45)' : 'rgba(100,100,100,0.35)',
            backdropFilter: 'blur(16px)',
            borderRadius: 10,
            padding: '4px',
            gap: 0,
          }}>
            {views.map(v => (
              <button
                key={v.key}
                onClick={() => {
                  setViewMode(v.key);
                  setSelectedResource(null);
                }}
                className="flex items-center gap-1.5 transition-all"
                style={{
                  padding: '7px 10px',
                  fontSize: 10,
                  fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 500,
                  color: isDarkMode ? '#ffffff' : '#000000',
                  borderRadius: 7,
                  background: viewMode === v.key ? (isDarkMode ? 'rgba(120,120,120,0.6)' : 'rgba(0,0,0,0.1)') : 'transparent',
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  border: isDarkMode ? '1.5px solid rgba(255,255,255,0.8)' : '1.5px solid rgba(0,0,0,0.6)',
                  background: viewMode === v.key ? (isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)') : 'transparent',
                  boxShadow: viewMode === v.key ? (isDarkMode ? '0 0 0 2px rgba(255,255,255,0.2)' : '0 0 0 2px rgba(0,0,0,0.1)') : 'none',
                }} />
                {v.label}
              </button>
            ))}

            {/* Day/Night toggle in mobile tab bar */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="flex items-center gap-1.5 transition-all"
              style={{
                padding: '7px 10px',
                fontSize: 10,
                color: isDarkMode ? '#ffffff' : '#000000',
                borderRadius: 7,
              }}
            >
              {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* ─── MOBILE TOP BAR ─── */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-11 transition-all duration-300"
          style={{
            background: isDarkMode ? 'rgba(15,15,15,0.8)' : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(16px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
            borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
            opacity: selectedResource ? 0 : 1,
            pointerEvents: selectedResource ? 'none' : 'auto',
          }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 10, color: isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {activeViewLabel} · {resources.length} entries
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2"
              style={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
            >
              <Search size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ─── DESKTOP: TOP-RIGHT SEARCH + DAY/NIGHT TOGGLE ─── */}
      {!isMobile && (
        <div className="fixed top-5 right-5 z-[100] flex items-center gap-2">
          {/* Day/Night toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="transition-all p-2.5 hover:scale-105"
            style={{
              color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
              background: isDarkMode ? 'rgba(80,80,80,0.35)' : 'rgba(200,200,200,0.5)',
              backdropFilter: 'blur(12px)',
              borderRadius: 10,
              border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
            }}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Search */}
          {searchOpen ? (
            <div className="flex items-center gap-2 px-4 py-2" style={{
              background: isDarkMode ? 'rgba(80,80,80,0.5)' : 'rgba(240,240,240,0.9)',
              backdropFilter: 'blur(20px)',
              borderRadius: 10,
              border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
            }}>
              <Search size={14} style={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent focus:outline-none w-48"
                style={{ color: isDarkMode ? '#ffffff' : '#000000', fontSize: 13, fontFamily: "'SF Mono', monospace" }}
                placeholder="Search..."
                autoFocus
              />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} style={{ color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="transition-all p-2.5 hover:scale-105"
              style={{
                color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                background: isDarkMode ? 'rgba(80,80,80,0.35)' : 'rgba(200,200,200,0.5)',
                backdropFilter: 'blur(12px)',
                borderRadius: 10,
                border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <Search size={16} />
            </button>
          )}
        </div>
      )}

      {/* ─── DESKTOP: BOTTOM-CENTER VIEW SWITCHER ─── */}
      {!isMobile && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100]" style={{ maxWidth: 'calc(100vw - 40px)' }}>
          <div className="flex items-center overflow-x-auto" style={{
            background: isDarkMode ? 'rgba(100,100,100,0.5)' : 'rgba(200,200,200,0.6)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
            borderRadius: 14,
            padding: '5px',
            border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            gap: 0,
            scrollbarWidth: 'none',
          }}>
            {views.map(v => (
              <button
                key={v.key}
                onClick={() => {
                  setViewMode(v.key);
                  setSelectedResource(null);
                }}
                className="flex items-center gap-1.5 transition-all shrink-0"
                style={{
                  padding: isNarrow ? '7px 8px' : '9px 14px',
                  fontSize: isNarrow ? 10 : 11,
                  fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                  color: isDarkMode ? '#ffffff' : '#000000',
                  borderRadius: 10,
                  background: viewMode === v.key ? (isDarkMode ? 'rgba(160,160,160,0.55)' : 'rgba(0,0,0,0.12)') : 'transparent',
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: isNarrow ? 8 : 10,
                  height: isNarrow ? 8 : 10,
                  borderRadius: '50%',
                  border: isDarkMode ? '1.5px solid rgba(255,255,255,0.8)' : '1.5px solid rgba(0,0,0,0.6)',
                  background: viewMode === v.key ? (isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)') : 'transparent',
                }} />
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── MOBILE SEARCH OVERLAY ─── */}
      {isMobile && searchOpen && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: isDarkMode ? 'rgba(10,10,10,0.95)' : 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center gap-3 px-4 h-14" style={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)' }}>
            <Search size={18} style={{ color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }} className="shrink-0" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-base focus:outline-none"
              style={{ color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)', fontFamily: "'SF Mono', monospace" }}
              placeholder="Search resources..."
              autoFocus
            />
            <button
              onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
              className="p-2"
              style={{ color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}
            >
              <X size={18} />
            </button>
          </div>
          {searchQuery.trim() && (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {resources
                .filter(r => {
                  const q = searchQuery.toLowerCase();
                  return r.title.toLowerCase().includes(q) ||
                    (r.creator && r.creator.toLowerCase().includes(q));
                })
                .slice(0, 20)
                .map(r => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery('');
                      handleSelectResource(r);
                    }}
                    className="w-full text-left py-3 flex items-center gap-3"
                    style={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}
                  >
                    {r.imageUrl && (
                      <img
                        src={r.imageUrl}
                        alt=""
                        className="w-10 h-10 object-contain shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm truncate" style={{ color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)' }}>{r.title}</div>
                      <div className="text-xs truncate" style={{ color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)' }}>
                        {r.creator && `${r.creator}`}
                        {r.creator && r.year && ' · '}
                        {r.year && `${r.year}`}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ─── GLOBAL INFO PANEL ─── */}
      {viewMode !== 'index' && (
        <InfoPanel
          resource={selectedResource}
          connections={connections}
          resources={resources}
          onClose={() => setSelectedResource(null)}
          onNavigate={handleNavigateToResource}
        />
      )}
    </div>
  );
}
