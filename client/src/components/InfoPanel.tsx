import { useEffect, useRef } from "react";
import type { Resource, Connection } from "../types";
import { TYPE_COLORS, CONNECTION_COLORS } from "../types";
import { X, ExternalLink } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

interface InfoPanelProps {
  resource: Resource | null;
  connections: Connection[];
  resources: Resource[];
  onClose: () => void;
  onNavigate: (r: Resource) => void;
}

export default function InfoPanel({ resource, connections, resources, onClose, onNavigate }: InfoPanelProps) {
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Scroll back to top when navigating between resources
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [resource?.id]);

  if (!resource) return null;

  const relatedConnections = connections.filter(
    c => c.sourceId === resource.id || c.targetId === resource.id
  );

  const grouped: Record<string, { conn: Connection; other: Resource }[]> = {};
  relatedConnections.forEach(c => {
    const otherId = c.sourceId === resource.id ? c.targetId : c.sourceId;
    const other = resources.find(r => r.id === otherId);
    if (!other) return;
    if (!grouped[c.type]) grouped[c.type] = [];
    grouped[c.type].push({ conn: c, other });
  });

  const dotColor = TYPE_COLORS[resource.type] || TYPE_COLORS.other;
  const isQuote = resource.type === 'quote' || !!resource.quoteText;

  const content = (
    <>
      {/* Video preview */}
      {resource.videoUrl && (
        <div className="hud-plate" style={{ marginBottom: 16 }}>
          {resource.videoUrl.includes('youtube.com') || resource.videoUrl.includes('youtu.be') ? (
            <iframe
              src={resource.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
              className="w-full aspect-video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ border: 'none', display: 'block' }}
            />
          ) : resource.videoUrl.includes('vimeo.com') ? (
            <iframe
              src={resource.videoUrl.replace('vimeo.com/', 'player.vimeo.com/video/')}
              className="w-full aspect-video"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              style={{ border: 'none', display: 'block' }}
            />
          ) : (
            <video
              src={resource.videoUrl}
              controls
              className="w-full max-h-52"
              poster={resource.imageUrl || undefined}
              style={{ display: 'block' }}
            />
          )}
        </div>
      )}

      {/* Image preview */}
      {resource.imageUrl && !resource.videoUrl && (
        <div className="hud-plate" style={{ marginBottom: 16 }}>
          <img
            src={resource.imageUrl}
            alt={resource.title}
            className={`w-full object-contain ${isMobile ? 'max-h-48' : 'max-h-56'}`}
            style={{ display: 'block' }}
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
          />
        </div>
      )}

      {/* Type label */}
      <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
        <span className="w-1.5 h-1.5" style={{ backgroundColor: dotColor }} />
        <span className="hud-label" style={{ fontSize: 9 }}>{resource.type}</span>
      </div>

      {/* Title — the one serif voice in the panel */}
      <h3 style={{
        fontFamily: "'EB Garamond', Georgia, serif",
        fontSize: isMobile ? 22 : 20,
        fontWeight: 500,
        lineHeight: 1.25,
        color: 'var(--ink-full)',
        marginBottom: 14,
      }}>
        {resource.title}
      </h3>

      {/* Quote text */}
      {isQuote && resource.quoteText && (
        <blockquote style={{
          marginBottom: 14,
          paddingLeft: 12,
          borderLeft: '1px solid var(--hairline)',
        }}>
          <p style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            color: 'var(--ink-mid)', fontSize: 14, lineHeight: 1.7, fontStyle: 'italic',
          }}>
            &ldquo;{resource.quoteText}&rdquo;
          </p>
        </blockquote>
      )}

      {/* Metadata — hairline index table */}
      <div style={{ borderTop: '1px solid var(--divider)' }}>
        {resource.creator && <Row label="Creator" value={resource.creator} />}
        {resource.year && <Row label="Year" value={String(resource.year)} />}
        {resource.language && (
          <Row label="Language" value={resource.language === 'zh' ? '中文' : 'English'} />
        )}
        {resource.location && <Row label="Location" value={resource.location} />}
        {resource.themes.length > 0 && (
          <Row label="Themes" value={resource.themes.join('  /  ')} />
        )}
        {resource.tags.length > 0 && (
          <Row label="Tags" value={resource.tags.map(t => `#${t}`).join('  ')} dim />
        )}
      </div>

      {/* Description */}
      {resource.description && (
        <p style={{
          fontFamily: "'EB Garamond', Georgia, serif",
          color: 'var(--ink-mid)',
          fontSize: 13.5,
          lineHeight: 1.7,
          marginTop: 14,
        }}>
          {resource.description}
        </p>
      )}

      {/* Source + date */}
      <div className="flex items-baseline justify-between" style={{ marginTop: 16 }}>
        {resource.url ? (
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hud-item flex items-center gap-1.5"
            style={{ padding: isMobile ? '4px 0' : 0 }}
          >
            <ExternalLink size={10} />
            <span style={{ borderBottom: '1px solid var(--divider)' }}>Source</span>
          </a>
        ) : <span />}
        <span className="hud-label" style={{ fontSize: 9, color: 'var(--ink-faint)' }}>
          {resource.addedAt
            ? `Added ${new Date(resource.addedAt).toLocaleDateString()}`
            : `Catalogued ${new Date(resource.createdAt).toLocaleDateString()}`
          }
        </span>
      </div>

      {/* Connections */}
      {Object.keys(grouped).length > 0 && (
        <div style={{ marginTop: 22, paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
          <span className="hud-label" style={{ fontSize: 9 }}>
            Connections — {relatedConnections.length}
          </span>
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type} style={{ marginTop: 12 }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                <span className="w-1.5 h-1.5" style={{ backgroundColor: CONNECTION_COLORS[type] || 'var(--ink-dim)' }} />
                <span className="hud-label" style={{ fontSize: 9 }}>
                  {type} ({items.length})
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {items.slice(0, 8).map(({ other }) => (
                  <button
                    key={other.id}
                    onClick={() => onNavigate(other)}
                    className="block w-full text-left truncate"
                    style={{
                      fontFamily: 'var(--hud-mono)',
                      fontSize: 11,
                      color: 'var(--ink-mid)',
                      padding: isMobile ? '5px 0' : '3px 0',
                      borderBottom: '1px solid var(--divider)',
                      transition: 'color 150ms var(--hud-ease)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ink-full)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ink-mid)'; }}
                  >
                    {other.title}
                  </button>
                ))}
                {items.length > 8 && (
                  <span className="hud-label" style={{ fontSize: 9, color: 'var(--ink-faint)', paddingTop: 4 }}>
                    +{items.length - 8} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  // Mobile: flat bottom sheet
  if (isMobile) {
    return (
      <>
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={onClose}
        />
        <div
          ref={panelRef}
          className="fixed bottom-0 left-0 right-0 z-50 max-h-[78vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
          style={{
            background: 'var(--panel)',
            borderTop: '1px solid var(--hairline)',
            padding: '14px 20px 28px',
            color: 'var(--ink-full)',
            scrollbarWidth: 'thin',
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 hud-item"
          >
            <X size={16} />
          </button>
          {content}
        </div>
      </>
    );
  }

  // Desktop: full-height right column, hairlined, flat
  return (
    <div
      ref={panelRef}
      className="fixed right-0 top-0 bottom-0 z-50 overflow-y-auto animate-in slide-in-from-right duration-300"
      style={{
        width: 340,
        background: 'var(--panel)',
        borderLeft: '1px solid var(--hairline)',
        padding: '52px 24px 32px',
        color: 'var(--ink-full)',
        scrollbarWidth: 'thin',
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 hud-item"
      >
        <X size={14} />
      </button>
      {content}
    </div>
  );
}

function Row({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="hud-row">
      <span className="hud-label" style={{ fontSize: 9, width: 64, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--hud-mono)',
        fontSize: 11,
        lineHeight: 1.5,
        color: dim ? 'var(--ink-dim)' : 'var(--ink-mid)',
      }}>
        {value}
      </span>
    </div>
  );
}
