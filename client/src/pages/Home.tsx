import { useState, useMemo } from "react";
import type { Resource, ViewMode } from "../types";
import { useResources } from "../data/useResources";
import OrbitView from "@/components/OrbitView";
import IndexView from "@/components/IndexView";
import InfoPanel from "@/components/InfoPanel";
import { Search, X, Sun, Moon } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

export default function Home() {
  const isMobile = useIsMobile();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    if (v && ['orbit', 'index'].includes(v)) {
      return v as ViewMode;
    }
    return 'orbit';
  });

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const { resources, connections, isLoading } = useResources();

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return resources.filter(r =>
      r.title.toLowerCase().includes(q) ||
      (r.creator && r.creator.toLowerCase().includes(q)) ||
      r.themes.some(t => t.toLowerCase().includes(q)) ||
      r.tags.some(t => t.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [searchQuery, resources]);

  const handleSelectResource = (r: Resource) => {
    setSelectedResource(r);
  };

  const handleNavigateToResource = (r: Resource) => {
    setSelectedResource(r);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
  };

  const views: { key: ViewMode; label: string }[] = [
    { key: 'orbit', label: 'Orbit' },
    { key: 'index', label: 'Index' },
  ];

  if (isLoading) {
    return (
      <div data-theme={isDarkMode ? 'dark' : 'light'} className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--page)' }}>
        <div className="hud-label animate-pulse">Loading atlas…</div>
      </div>
    );
  }

  return (
    <div
      data-theme={isDarkMode ? 'dark' : 'light'}
      className="fixed inset-0 overflow-hidden"
      style={{ background: 'var(--page)', transition: 'background 300ms var(--hud-ease)' }}
    >
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
      </div>

      {/* ─── DESKTOP: TOP-LEFT — wordmark + view switcher ─── */}
      {!isMobile && (
        <div className="fixed top-6 left-7 z-[100] flex items-baseline gap-7">
          <span className="hud-label" style={{ color: 'var(--ink-full)', letterSpacing: '0.14em' }}>
            Atlas
          </span>
          <div className="flex items-baseline gap-4">
            {views.map(v => (
              <button
                key={v.key}
                onClick={() => {
                  setViewMode(v.key);
                  setSelectedResource(null);
                }}
                className="hud-item"
                data-active={viewMode === v.key}
                style={{
                  paddingBottom: 2,
                  borderBottom: viewMode === v.key
                    ? '1px solid var(--ink-full)'
                    : '1px solid transparent',
                  transition: 'color 150ms var(--hud-ease), border-color 150ms var(--hud-ease)',
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
          <span className="hud-label" style={{ fontSize: 9, color: 'var(--ink-faint)' }}>
            {resources.length} entries
          </span>
        </div>
      )}

      {/* ─── DESKTOP: TOP-RIGHT — search + theme ─── */}
      {!isMobile && (
        <div className="fixed top-6 right-7 z-[100] flex items-start gap-5">
          <div className="flex flex-col items-end">
            {searchOpen ? (
              <div className="flex items-center gap-2" style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: 3 }}>
                <Search size={12} style={{ color: 'var(--ink-dim)' }} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-transparent focus:outline-none w-52"
                  style={{ color: 'var(--ink-full)', fontSize: 11, fontFamily: 'var(--hud-mono)' }}
                  placeholder="Title, creator, theme, tag…"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Escape') closeSearch();
                    if (e.key === 'Enter' && searchResults.length > 0) {
                      handleSelectResource(searchResults[0]);
                      closeSearch();
                    }
                  }}
                />
                <button onClick={closeSearch} className="hud-item">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button onClick={() => setSearchOpen(true)} className="hud-item" style={{ paddingBottom: 4 }}>
                Search
              </button>
            )}

            {/* Live results */}
            {searchOpen && searchQuery.trim() && (
              <div
                className="overflow-y-auto"
                style={{
                  marginTop: 8,
                  width: 280,
                  maxHeight: 320,
                  background: 'var(--panel)',
                  border: '1px solid var(--hairline)',
                }}
              >
                {searchResults.length === 0 && (
                  <div className="hud-label" style={{ padding: '10px 12px', fontSize: 9 }}>
                    No matches
                  </div>
                )}
                {searchResults.map(r => (
                  <button
                    key={r.id}
                    onClick={() => {
                      handleSelectResource(r);
                      closeSearch();
                    }}
                    className="w-full text-left flex items-center gap-3"
                    style={{
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--divider)',
                      transition: 'background 150ms var(--hud-ease)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--plate)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {r.imageUrl && (
                      <img
                        src={r.imageUrl}
                        alt=""
                        className="w-8 h-8 object-cover shrink-0 hud-plate"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="truncate" style={{ fontFamily: 'var(--hud-mono)', fontSize: 11, color: 'var(--ink-full)' }}>
                        {r.title}
                      </div>
                      <div className="truncate hud-label" style={{ fontSize: 9 }}>
                        {r.creator}{r.creator && r.year ? ' · ' : ''}{r.year ?? ''}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="hud-item"
            style={{ paddingBottom: 4 }}
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>
      )}

      {/* ─── MOBILE TOP BAR ─── */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-11 transition-opacity duration-300"
          style={{
            background: 'var(--page)',
            borderBottom: '1px solid var(--divider)',
            opacity: selectedResource ? 0 : 1,
            pointerEvents: selectedResource ? 'none' : 'auto',
          }}
        >
          <span className="hud-label" style={{ fontSize: 9 }}>
            Atlas · {resources.length} entries
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 hud-item"
            >
              <Search size={15} />
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 hud-item"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      )}

      {/* ─── MOBILE BOTTOM TAB BAR ─── */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-40 transition-opacity duration-300"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 10px)',
            background: 'var(--page)',
            borderTop: '1px solid var(--hairline)',
            opacity: selectedResource ? 0 : 1,
            pointerEvents: selectedResource ? 'none' : 'auto',
          }}
        >
          <div className="flex items-center justify-center">
            {views.map(v => (
              <button
                key={v.key}
                onClick={() => {
                  setViewMode(v.key);
                  setSelectedResource(null);
                }}
                className="hud-item"
                data-active={viewMode === v.key}
                style={{
                  padding: '13px 18px',
                  borderBottom: viewMode === v.key
                    ? '1px solid var(--ink-full)'
                    : '1px solid transparent',
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── MOBILE SEARCH OVERLAY ─── */}
      {isMobile && searchOpen && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--page)' }}>
          <div className="flex items-center gap-3 px-4 h-14" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <Search size={16} style={{ color: 'var(--ink-dim)' }} className="shrink-0" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent focus:outline-none"
              style={{ color: 'var(--ink-full)', fontSize: 14, fontFamily: 'var(--hud-mono)' }}
              placeholder="Title, creator, theme, tag…"
              autoFocus
            />
            <button onClick={closeSearch} className="p-2 hud-item">
              <X size={16} />
            </button>
          </div>
          {searchQuery.trim() && (
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {searchResults.map(r => (
                <button
                  key={r.id}
                  onClick={() => {
                    closeSearch();
                    handleSelectResource(r);
                  }}
                  className="w-full text-left py-3 flex items-center gap-3"
                  style={{ borderBottom: '1px solid var(--divider)' }}
                >
                  {r.imageUrl && (
                    <img
                      src={r.imageUrl}
                      alt=""
                      className="w-10 h-10 object-cover shrink-0 hud-plate"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="truncate" style={{ fontFamily: 'var(--hud-mono)', fontSize: 13, color: 'var(--ink-full)' }}>{r.title}</div>
                    <div className="truncate hud-label" style={{ fontSize: 10 }}>
                      {r.creator}{r.creator && r.year ? ' · ' : ''}{r.year ?? ''}
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
