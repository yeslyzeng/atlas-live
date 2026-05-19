import { useState } from "react";
import type { Resource, ViewMode } from "../types";
import { CONNECTION_COLORS } from "../types";
import { useResources } from "../data/useResources";
import OrbitView from "@/components/OrbitView";
import KaleidoView from "@/components/KaleidoView";
import IndexView from "@/components/IndexView";
import InfoPanel from "@/components/InfoPanel";
import { Plus, Search, X, Orbit, Gem, List } from "lucide-react";
import { useIsMobile, useIsNarrow } from "@/hooks/useIsMobile";

export default function Home() {
  const isMobile = useIsMobile();
  const isNarrow = useIsNarrow();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    if (v && ['orbit', 'kaleido', 'index'].includes(v)) {
      return v as ViewMode;
    }
    return 'orbit';
  });

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
    { key: 'kaleido', label: 'Kaleido', icon: <Gem size={isMobile ? 18 : 14} /> },
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
    <div className="fixed inset-0 bg-[#0a0a0a] overflow-hidden">
      {/* Main view area */}
      <div
        className="absolute inset-0 transition-all duration-300"
        style={{
          filter: (isMobile && selectedResource) ? 'blur(12px) brightness(0.4)' : 'none',
          transform: (isMobile && selectedResource) ? 'scale(1.02)' : 'none',
          pointerEvents: (isMobile && selectedResource) ? 'none' : 'auto',
        }}
      >
        {viewMode === 'orbit' && (
          <OrbitView
            resources={resources}
            connections={connections}
            onSelectResource={handleSelectResource}
          />
        )}
        {viewMode === 'kaleido' && (
          <KaleidoView
            resources={resources}
            connections={connections}
            onSelectResource={handleSelectResource}
          />
        )}
        {viewMode === 'index' && (
          <IndexView
            resources={resources}
            connections={connections}
            onSelectResource={handleSelectResource}
          />
        )}
      </div>

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
            background: 'rgba(160,160,160,0.45)',
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
                  color: '#ffffff',
                  borderRadius: 7,
                  background: viewMode === v.key ? 'rgba(120,120,120,0.6)' : 'transparent',
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(255,255,255,0.8)',
                  background: viewMode === v.key ? 'rgba(255,255,255,0.85)' : 'transparent',
                  boxShadow: viewMode === v.key ? '0 0 0 2px rgba(255,255,255,0.2)' : 'none',
                }} />
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── MOBILE TOP BAR ─── */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-11 transition-all duration-300"
          style={{
            background: 'rgba(15,15,15,0.8)',
            backdropFilter: 'blur(16px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            opacity: selectedResource ? 0 : 1,
            pointerEvents: selectedResource ? 'none' : 'auto',
          }}
        >
          {/* Left: current view summary */}
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {activeViewLabel} · {resources.length} entries
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              <Search size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ─── DESKTOP: TOP-RIGHT SEARCH ─── */}
      {!isMobile && (
        <div className="fixed top-5 right-5 z-[100]">
          {searchOpen ? (
            <div className="flex items-center gap-2 px-4 py-2" style={{
              background: 'rgba(80,80,80,0.5)',
              backdropFilter: 'blur(20px)',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <Search size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent focus:outline-none w-48"
                style={{ color: '#ffffff', fontSize: 13, fontFamily: "'SF Mono', monospace" }}
                placeholder="Search..."
                autoFocus
              />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} style={{ color: 'rgba(255,255,255,0.4)' }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="transition-all p-2.5 hover:scale-105"
              style={{
                color: 'rgba(255,255,255,0.5)',
                background: 'rgba(80,80,80,0.35)',
                backdropFilter: 'blur(12px)',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.06)',
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
            background: 'rgba(100,100,100,0.5)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
            borderRadius: 14,
            padding: '5px',
            border: '1px solid rgba(255,255,255,0.08)',
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
                  color: '#ffffff',
                  borderRadius: 10,
                  background: viewMode === v.key ? 'rgba(160,160,160,0.55)' : 'transparent',
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: isNarrow ? 8 : 10,
                  height: isNarrow ? 8 : 10,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(255,255,255,0.8)',
                  background: viewMode === v.key ? 'rgba(255,255,255,0.85)' : 'transparent',
                }} />
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── MOBILE SEARCH OVERLAY ─── */}
      {isMobile && searchOpen && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center gap-3 px-4 h-14" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Search size={18} style={{ color: 'rgba(255,255,255,0.4)' }} className="shrink-0" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-base focus:outline-none"
              style={{ color: 'rgba(255,255,255,0.9)', fontFamily: "'SF Mono', monospace" }}
              placeholder="Search resources..."
              autoFocus
            />
            <button
              onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
              className="p-2"
              style={{ color: 'rgba(255,255,255,0.4)' }}
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
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    {r.imageUrl && (
                      <img
                        src={r.imageUrl}
                        alt=""
                        className="w-10 h-10 object-cover shrink-0 rounded"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>{r.title}</div>
                      <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
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
