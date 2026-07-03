import { useRef, useState, ReactNode } from "react";
import { useMotionValueEvent, useTransform, MotionValue } from "motion/react";

/**
 * VirtualGrid — renders an infinite 2D grid using periodic virtualization.
 * Based on Seth Thompson's VirtualGrid implementation.
 * 
 * Only renders items visible in the viewport + overscan.
 * Position is tracked via MotionValues for 60-120fps performance.
 */

interface VirtualGridItemProps {
  column: number;
  row: number;
  position: [MotionValue<number>, MotionValue<number>];
  itemsPerView: [number, number];
  gap?: [number, number];
  center?: boolean;
  transformValue?: (value: number) => string;
  children: (props: {
    column: number;
    row: number;
    x: MotionValue<string>;
    y: MotionValue<string>;
    width: string;
    height: string;
  }) => ReactNode;
}

function VirtualGridItem({
  column,
  row,
  position,
  itemsPerView,
  gap = [0, 0],
  center = false,
  transformValue = (value) => `${value}`,
  children,
}: VirtualGridItemProps) {
  const [positionX, positionY] = position;
  const [itemsPerViewX, itemsPerViewY] = itemsPerView;
  const [gapX, gapY] = gap;

  const slotWidth = 1 / itemsPerViewX;
  const slotHeight = 1 / itemsPerViewY;
  const width = slotWidth - gapX;
  const height = slotHeight - gapY;

  const leadingOffsetX = (center ? itemsPerViewX / 2 - 0.5 : 0) * slotWidth + gapX / 2;
  const leadingOffsetY = (center ? itemsPerViewY / 2 - 0.5 : 0) * slotHeight + gapY / 2;

  const offsetX = useTransform(() => column - positionX.get());
  const offsetY = useTransform(() => row - positionY.get());

  const x = useTransform(
    () => transformValue((offsetX.get() * slotWidth + leadingOffsetX) / width)
  );
  const y = useTransform(
    () => transformValue((offsetY.get() * slotHeight + leadingOffsetY) / height)
  );

  return children({
    column,
    row,
    width: transformValue(width),
    height: transformValue(height),
    x,
    y,
  });
}

interface VirtualGridProps {
  position: [MotionValue<number>, MotionValue<number>];
  itemsPerView: [number, number];
  gap?: [number, number];
  overscan?: [number, number];
  center?: boolean;
  transformValue?: (value: number) => string;
  children: (props: {
    column: number;
    row: number;
    x: MotionValue<string>;
    y: MotionValue<string>;
    width: string;
    height: string;
  }) => ReactNode;
}

export function VirtualGrid({
  position,
  itemsPerView,
  gap = [0, 0],
  overscan = [2, 2],
  center = false,
  transformValue = (value) => `${value}`,
  children,
}: VirtualGridProps) {
  const [positionX, positionY] = position;
  const [itemsPerViewX, itemsPerViewY] = itemsPerView;
  const [overscanX, overscanY] = overscan;

  const centerOffsetX = center ? itemsPerViewX / 2 - 0.5 : 0;
  const centerOffsetY = center ? itemsPerViewY / 2 - 0.5 : 0;

  const [startColumn, setStartColumn] = useState(
    Math.floor(positionX.get() - centerOffsetX)
  );
  const [startRow, setStartRow] = useState(
    Math.floor(positionY.get() - centerOffsetY)
  );

  const previousPositionX = useRef(positionX.get());
  const previousPositionY = useRef(positionY.get());

  useMotionValueEvent(positionX, "change", (latest) => {
    const offsetPosition = latest - centerOffsetX;
    setStartColumn(
      latest > previousPositionX.current
        ? Math.floor(offsetPosition)
        : Math.ceil(offsetPosition) - overscanX
    );
    previousPositionX.current = latest;
  });

  useMotionValueEvent(positionY, "change", (latest) => {
    const offsetPosition = latest - centerOffsetY;
    setStartRow(
      latest > previousPositionY.current
        ? Math.floor(offsetPosition)
        : Math.ceil(offsetPosition) - overscanY
    );
    previousPositionY.current = latest;
  });

  return Array.from({
    length: Math.ceil(itemsPerViewX) + overscanX + (center ? 1 : 0),
  }).flatMap((_, slotX) =>
    Array.from({
      length: Math.ceil(itemsPerViewY) + overscanY + (center ? 1 : 0),
    }).map((__, slotY) => {
      const column = startColumn + slotX;
      const row = startRow + slotY;
      return (
        <VirtualGridItem
          key={`${column}-${row}`}
          column={column}
          row={row}
          position={position}
          itemsPerView={itemsPerView}
          gap={gap}
          center={center}
          transformValue={transformValue}
        >
          {children}
        </VirtualGridItem>
      );
    })
  );
}
