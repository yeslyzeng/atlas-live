import { useRef, useMemo } from 'react';
import { motion, useMotionValue, animate } from 'motion/react';
import { useResizeObserver } from 'usehooks-ts';
import { VirtualGrid } from './grid/VirtualGrid';
import { useDragScroll } from './grid/useDragScroll';
import { mod, getShortestConnection } from './grid/math';
import type { Resource } from '../types';

interface GridViewProps {
  resources: Resource[];
  onSelectResource: (r: Resource) => void;
  isDarkMode?: boolean;
}

/**
 * GridView — Infinite image grid (flat torus).
 *
 * Implementation follows Seth Thompson's "Infinite Image Grids are Flat Toruses":
 * 1. Position tracked as continuous coordinates on a 2D number plane
 * 2. VirtualGrid virtualizes rendering — only visible cells + overscan are in DOM
 * 3. Periodic boundary operator maps infinite indices to finite resource array
 * 4. Drag + wheel input with momentum-based inertia (useDragScroll)
 * 5. goTo uses shortest connection in periodic space for efficient navigation
 *
 * Topologically: scrolling this grid = traveling across a flat torus surface.
 * The grid wraps seamlessly in both X and Y — there are no edges.
 */
export default function GridView({ resources, onSelectResource, isDarkMode = true }: GridViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { width: viewportWidth = 0, height: viewportHeight = 0 } = useResizeObserver({ ref: ref as any });

  const positionX = useMotionValue(0);
  const positionY = useMotionValue(0);

  // Only resources with images for the grid
  const imageResources = useMemo(() => resources.filter(r => r.imageUrl), [resources]);

  // Grid dimensions — arrange resources in a roughly square grid
  const columns = useMemo(() => Math.max(1, Math.ceil(Math.sqrt(imageResources.length * 1.5))), [imageResources]);
  const rows = useMemo(() => Math.max(1, Math.ceil(imageResources.length / columns)), [imageResources, columns]);

  // Layout parameters
  const viewportAspectRatio = viewportWidth && viewportHeight ? viewportWidth / viewportHeight : 4 / 3;
  const itemAspectRatio = 3 / 4; // portrait orientation
  const itemsPerViewX = 4;
  const gapX = 0.012;
  const gapY = gapX * viewportAspectRatio;
  const itemWidth = (1 - (itemsPerViewX + 1) * gapX) / itemsPerViewX;
  const itemHeight = (itemWidth * viewportAspectRatio) / itemAspectRatio;
  const itemsPerViewY = (1 - gapY) / (itemHeight + gapY);

  // Drag/scroll with inertia
  const bind = useDragScroll(({ offset }) => {
    positionX.set((offset[0] / (viewportWidth || 1)) * itemsPerViewX);
    positionY.set((offset[1] / (viewportHeight || 1)) * itemsPerViewY);
  });

  // goTo — navigate to a specific resource using shortest path in periodic space
  const goTo = (indexX: number, indexY: number) => {
    const currentX = positionX.get();
    const targetX = currentX + getShortestConnection(currentX, indexX, columns);
    const currentY = positionY.get();
    const targetY = currentY + getShortestConnection(currentY, indexY, rows);
    animate(positionX, targetX, { type: "spring", mass: 0.1, restSpeed: 0.01 });
    animate(positionY, targetY, { type: "spring", mass: 0.1, restSpeed: 0.01 });
  };

  const handleClick = (resource: Resource, column: number, row: number) => {
    // Navigate to center the clicked item, then select it
    goTo(column, row);
    onSelectResource(resource);
  };

  return (
    <div
      ref={ref}
      className="absolute inset-0 overflow-hidden overscroll-contain"
      style={{ touchAction: 'none', background: isDarkMode ? '#1a1a1a' : '#f5f5f5' }}
      {...(typeof bind === 'function' ? (bind as any)() : {})}
    >
      <VirtualGrid
        position={[positionX, positionY]}
        itemsPerView={[itemsPerViewX, itemsPerViewY]}
        gap={[gapX, gapY]}
        transformValue={(value) => `${value * 100}%`}
        center
      >
        {({ column, row, x, y, width, height }) => {
          // Periodic boundary operator: map infinite indices to finite resources
          const indexX = mod(column, columns);
          const indexY = mod(row, rows);
          const resourceIdx = mod(indexY * columns + indexX, imageResources.length);
          const resource = imageResources[resourceIdx];

          if (!resource) return null;

          return (
            <motion.div
              className="absolute top-0 left-0 overflow-hidden will-change-transform cursor-pointer"
              style={{ x, y, width, height }}
              onClick={() => handleClick(resource, column, row)}
              whileHover={{ scale: 1.03, zIndex: 10 }}
              transition={{ duration: 0.2 }}
            >
              <img
                src={resource.imageUrl!}
                alt={resource.title}
                className="w-full h-full object-cover"
                draggable="false"
                loading="lazy"
              />
              {/* Subtle title overlay on hover via CSS */}
              <div className="absolute inset-0 flex items-end opacity-0 hover:opacity-100 transition-opacity duration-200">
                <div className="w-full p-2" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}>
                  <div className="text-[10px] text-white/90 truncate">{resource.title}</div>
                  {resource.creator && (
                    <div className="text-[8px] text-white/50 truncate">{resource.creator}</div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        }}
      </VirtualGrid>
    </div>
  );
}
