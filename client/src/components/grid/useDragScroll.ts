import { useEffect, useRef } from "react";
import { useGesture } from "@use-gesture/react";

const INERTIA_TIME_CONSTANT_MS = 325;

interface DragScrollOffset {
  offset: [number, number];
}

/**
 * useDragScroll — momentum-based drag and scroll hook.
 * Combines drag + wheel input with iOS-style kinetic inertia on release.
 * Based on Seth Thompson's implementation.
 */
export const useDragScroll = (
  onOffset: (state: DragScrollOffset) => void,
  config?: any
) => {
  const { target, eventOptions, window: win, enabled, transform, ...gestureConfig } = config ?? {};

  const onOffsetRef = useRef(onOffset);
  const wheelOffsetRef = useRef<[number, number]>([0, 0]);
  const dragOffsetRef = useRef<[number, number]>([0, 0]);
  const releaseVelocityRef = useRef<[number, number]>([0, 0]);
  const releaseOffsetRef = useRef<[number, number]>([0, 0]);
  const frameRef = useRef<number | null>(null);
  const lastInertiaTimestampRef = useRef<number | null>(null);

  onOffsetRef.current = onOffset;

  const emitOffset = () => {
    onOffsetRef.current({
      offset: [
        -(wheelOffsetRef.current[0] + dragOffsetRef.current[0] + releaseOffsetRef.current[0]),
        -(wheelOffsetRef.current[1] + dragOffsetRef.current[1] + releaseOffsetRef.current[1]),
      ],
    });
  };

  const stopInertia = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    lastInertiaTimestampRef.current = null;
  };

  const stepInertia = (timestamp: number) => {
    const previousTimestamp = lastInertiaTimestampRef.current ?? timestamp;
    const deltaMs = timestamp - previousTimestamp;
    const damping = Math.exp(-deltaMs / INERTIA_TIME_CONSTANT_MS);
    lastInertiaTimestampRef.current = timestamp;

    releaseOffsetRef.current = [
      releaseOffsetRef.current[0] + releaseVelocityRef.current[0] * deltaMs,
      releaseOffsetRef.current[1] + releaseVelocityRef.current[1] * deltaMs,
    ];
    releaseVelocityRef.current = [
      releaseVelocityRef.current[0] * damping,
      releaseVelocityRef.current[1] * damping,
    ];

    emitOffset();

    if (
      Math.abs(releaseVelocityRef.current[0]) < 0.005 &&
      Math.abs(releaseVelocityRef.current[1]) < 0.005
    ) {
      releaseVelocityRef.current = [0, 0];
      frameRef.current = null;
      return;
    }
    frameRef.current = requestAnimationFrame(stepInertia);
  };

  const bind = useGesture(
    {
      onDrag: ({ event, offset: [x, y] }) => {
        event?.preventDefault();
        dragOffsetRef.current = [x, y];
        emitOffset();
      },
      onDragStart: () => {
        releaseVelocityRef.current = [0, 0];
        stopInertia();
      },
      onDragEnd: ({ velocity: [vx, vy], direction: [dirx, diry] }) => {
        releaseVelocityRef.current =
          Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001
            ? [vx * dirx, vy * diry]
            : [0, 0];
        stopInertia();
        frameRef.current = requestAnimationFrame(stepInertia);
      },
      onWheel: ({ offset: [x, y] }) => {
        wheelOffsetRef.current = [-x, -y];
        emitOffset();
      },
    },
    {
      target,
      eventOptions,
      window: win,
      enabled,
      transform,
      drag: { filterTaps: true, ...gestureConfig },
      wheel: gestureConfig,
    }
  );

  useEffect(() => stopInertia, []);

  return bind;
};
