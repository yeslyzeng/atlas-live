import { useEffect, useRef } from "react";
import type { Resource, Connection } from "../types";
import { TYPE_COLORS, CONNECTION_COLORS } from "../types";
import { X, ExternalLink, MapPin } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

interface InfoPanelProps {
  resource: Resource | null;
  connections: Connection[];
  resources: Resource[];
  onClose: () => void;
  onNavigate: (r: Resource) => void;
}

// Frosted glass color palette
const TEXT_PRIMARY = 'rgba(255,255,255,0.92)';
const TEXT_SECONDARY = 'rgba(255,255,255,0.6)';
const TEXT_MUTED = 'rgba(255,255,255,0.35)';
const TEXT_FAINT = 'rgba(255,255,255,0.2)';
const BORDER_COLOR = 'rgba(255,255,255,0.08)';
const TAG_BG = 'rgba(255,255,255,0.06)';
const TAG_TEXT = 'rgba(255,255,255,0.5)';

// Map connection type keys to vibrant colors
const CONN_EDITORIAL_COLORS: Record<string, string> = {
  type: 'hsl(270, 55%, 65%)',
  colour: 'hsl(38, 70%, 60%)',
  theme: 'hsl(340, 60%, 65%)',
  creator: 'hsl(160, 55%, 55%)',
};

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
        <div style={{ margin: '0 -4px 12px' }}>
          {resource.videoUrl.includes('youtube.com') || resource.videoUrl.includes('youtu.be') ? (
            <iframe
              src={resource.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
              className="w-full aspect-video rounded"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ border: 'none' }}
            />
          ) : resource.videoUrl.includes('vimeo.com') ? (
            <iframe
              src={resource.videoUrl.replace('vimeo.com/', 'player.vimeo.com/video/')}
              className="w-full aspect-video rounded"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              style={{ border: 'none' }}
            />
          ) : (
            <video
              src={resource.videoUrl}
              controls
              className="w-full max-h-48 rounded"
              poster={resource.imageUrl || undefined}
            />
          )}
        </div>
      )}

      {/* Image preview */}
      {resource.imageUrl && !resource.videoUrl && (
        <div style={{ margin: '0 -4px 12px' }}>
          <img
            src={resource.imageUrl}
            alt={resource.title}
            className={`w-full object-contain rounded ${isMobile ? 'max-h-44' : 'max-h-52'}`}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}

      {/* Quote text */}
      {isQuote && resource.quoteText && (
        <blockquote style={{
          marginBottom: 12,
          paddingLeft: 12,
          borderLeft: `2px solid rgba(255,255,255,0.15)`,
        }}>
          <p style={{ color: TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7, fontStyle: 'italic' }}>
            &ldquo;{resource.quoteText}&rdquo;
          </p>
        </blockquote>
      )}

      {/* Type label */}
      <div className="flex items-center gap-1.5" style={{ marginBottom: 4 }}>
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
        <span style={{
          fontSize: 9,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: TEXT_MUTED,
        }}>
          {resource.type}
        </span>
      </div>

      {/* Title */}
      <h3 style={{
        fontSize: isMobile ? 20 : 17,
        fontWeight: 500,
        lineHeight: 1.3,
        color: TEXT_PRIMARY,
        marginBottom: 8,
      }}>
        {resource.title}
      </h3>

      {/* Metadata rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {resource.creator && (
          <InfoRow label="Creator" value={resource.creator} />
        )}
        {resource.year && (
          <InfoRow label="Year" value={String(resource.year)} />
        )}
        {resource.language && (
          <InfoRow label="Language" value={resource.language === 'zh' ? '中文' : 'English'} />
        )}
        {resource.location && (
          <div className="flex items-start gap-2">
            <span style={{ color: TEXT_MUTED, width: 56, flexShrink: 0, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Location</span>
            <span className="flex items-center gap-1" style={{ color: TEXT_SECONDARY, fontSize: 12 }}>
              <MapPin size={10} style={{ color: TEXT_MUTED }} />
              {resource.location}
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      {resource.description && (
        <p style={{
          color: TEXT_SECONDARY,
          fontSize: 12,
          lineHeight: 1.7,
          marginTop: 10,
          marginBottom: 8,
        }}>
          {resource.description}
        </p>
      )}

      {/* Themes */}
      {resource.themes.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: TEXT_FAINT, display: 'block', marginBottom: 4 }}>Themes</span>
          <div className="flex flex-wrap gap-1">
            {resource.themes.map(t => (
              <span key={t} style={{
                padding: '2px 7px',
                background: TAG_BG,
                color: TAG_TEXT,
                fontSize: 10,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {resource.tags.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: TEXT_FAINT, display: 'block', marginBottom: 4 }}>Tags</span>
          <div className="flex flex-wrap gap-1">
            {resource.tags.map(t => (
              <span key={t} style={{
                padding: '2px 7px',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.4)',
                fontSize: 10,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* URL */}
      {resource.url && (
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-1 transition-colors ${isMobile ? 'py-2' : ''}`}
          style={{
            color: TEXT_MUTED,
            fontSize: isMobile ? 13 : 11,
            marginTop: 10,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = TEXT_PRIMARY; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = TEXT_MUTED; }}
        >
          <ExternalLink size={isMobile ? 13 : 10} />
          <span>Source</span>
        </a>
      )}

      {/* Added date */}
      <div style={{ marginTop: 10, fontSize: 9, color: TEXT_FAINT }}>
        {resource.addedAt
          ? `Added ${new Date(resource.addedAt).toLocaleDateString()}`
          : `Catalogued ${new Date(resource.createdAt).toLocaleDateString()}`
        }
      </div>

      {/* Connections */}
      {Object.keys(grouped).length > 0 && (
        <div style={{
          marginTop: 14,
          paddingTop: 10,
          borderTop: `1px solid ${BORDER_COLOR}`,
        }}>
          <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: TEXT_FAINT }}>Connections</span>
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type} style={{ marginTop: 8 }}>
              <span style={{
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: CONN_EDITORIAL_COLORS[type] || TEXT_MUTED,
                fontWeight: 500,
              }}>
                {type} ({items.length})
              </span>
              <div style={{ marginTop: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {items.slice(0, 8).map(({ other }) => (
                  <button
                    key={other.id}
                    onClick={() => onNavigate(other)}
                    className={`block w-full text-left transition-colors truncate ${isMobile ? 'py-1' : ''}`}
                    style={{ color: TEXT_SECONDARY, fontSize: isMobile ? 13 : 11 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = TEXT_PRIMARY; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = TEXT_SECONDARY; }}
                  >
                    {other.title}
                  </button>
                ))}
                {items.length > 8 && (
                  <span style={{ fontSize: 9, color: TEXT_FAINT }}>+{items.length - 8} more</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  // Mobile: bottom sheet with frosted glass
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={onClose}
        />
        {/* Bottom sheet */}
        <div
          ref={panelRef}
          className="fixed bottom-0 left-0 right-0 z-50 max-h-[75vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
          style={{
            background: 'rgba(15, 15, 15, 0.85)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px 16px 0 0',
            padding: '12px 20px 24px',
            fontSize: 13,
            color: TEXT_PRIMARY,
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.1) transparent',
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
          </div>
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 transition-colors p-1"
            style={{ color: TEXT_MUTED }}
          >
            <X size={18} />
          </button>
          {content}
        </div>
      </>
    );
  }

  // Desktop: side panel with frosted glass
  return (
    <div
      ref={panelRef}
      className="fixed right-6 top-1/2 -translate-y-1/2 z-50 w-72 max-h-[80vh] overflow-y-auto"
      style={{
        background: 'rgba(15, 15, 15, 0.75)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: '16px 18px',
        fontSize: 13,
        color: TEXT_PRIMARY,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.1) transparent',
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-3 right-3 transition-colors"
        style={{ color: TEXT_MUTED }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = TEXT_PRIMARY; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = TEXT_MUTED; }}
      >
        <X size={14} />
      </button>
      {content}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span style={{
        color: TEXT_MUTED,
        width: 56,
        flexShrink: 0,
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>{label}</span>
      <span style={{ color: TEXT_SECONDARY, fontSize: 12 }}>{value}</span>
    </div>
  );
}
