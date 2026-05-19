import { useMemo } from 'react';
import rawResources from './resources.json';
import { generateConnections } from './connections';
import type { Resource, Connection } from '../types';

/**
 * Hook that provides the static resource data and computed connections.
 * Replaces the original tRPC-based data fetching.
 */
export function useResources(): { resources: Resource[]; connections: Connection[]; isLoading: boolean } {
  const resources: Resource[] = useMemo(() => {
    return (rawResources as any[]).map((r) => ({
      ...r,
      themes: Array.isArray(r.themes) ? r.themes : (r.themes ? JSON.parse(r.themes) : []),
      tags: Array.isArray(r.tags) ? r.tags : (r.tags ? JSON.parse(r.tags) : []),
      addedAt: r.addedAt ? new Date(r.addedAt) : null,
      createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
    }));
  }, []);

  const connections: Connection[] = useMemo(() => generateConnections(resources), [resources]);

  return { resources, connections, isLoading: false };
}
