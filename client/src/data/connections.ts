/**
 * Generate connections from the static resource data.
 * This replicates the server-side logic from the original atlas project.
 */
import type { Resource, Connection } from '../types';

export function generateConnections(resources: Resource[]): Connection[] {
  const connectionTypeColors: Record<string, string> = {
    type: 'hsla(250, 60%, 72%, 1)',
    colour: 'hsla(40, 65%, 65%, 1)',
    theme: 'hsla(335, 55%, 70%, 1)',
    creator: 'hsla(155, 55%, 60%, 1)',
  };

  const connections: Connection[] = [];

  for (let i = 0; i < resources.length; i++) {
    for (let j = i + 1; j < resources.length; j++) {
      const a = resources[i];
      const b = resources[j];

      // Type connection
      if (a.type === b.type) {
        connections.push({
          sourceId: a.id,
          targetId: b.id,
          type: 'type',
          color: connectionTypeColors.type,
          label: a.type,
        });
      }

      // Colour connection (similar dominant hue within 30°)
      const aHue = a.dominantHue;
      const bHue = b.dominantHue;
      if (aHue != null && bHue != null && aHue > 0 && bHue > 0) {
        const hueDiff = Math.min(Math.abs(aHue - bHue), 360 - Math.abs(aHue - bHue));
        if (hueDiff <= 30) {
          const avgHue = Math.round((aHue + bHue) / 2);
          const hueLabel =
            avgHue < 15 || avgHue >= 345 ? 'red' :
            avgHue < 45 ? 'orange' :
            avgHue < 75 ? 'yellow' :
            avgHue < 150 ? 'green' :
            avgHue < 195 ? 'cyan' :
            avgHue < 255 ? 'blue' :
            avgHue < 285 ? 'indigo' :
            avgHue < 345 ? 'violet' : 'red';
          connections.push({
            sourceId: a.id,
            targetId: b.id,
            type: 'colour',
            color: connectionTypeColors.colour,
            label: hueLabel,
          });
        }
      }

      // Theme connection (shared themes)
      const sharedThemes = a.themes.filter((t: string) => b.themes.includes(t));
      if (sharedThemes.length > 0) {
        connections.push({
          sourceId: a.id,
          targetId: b.id,
          type: 'theme',
          color: connectionTypeColors.theme,
          label: sharedThemes[0],
        });
      }

      // Creator connection
      if (a.creator && b.creator && a.creator === b.creator) {
        connections.push({
          sourceId: a.id,
          targetId: b.id,
          type: 'creator',
          color: connectionTypeColors.creator,
          label: a.creator,
        });
      }
    }
  }

  return connections;
}
