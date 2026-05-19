export interface Resource {
  id: number;
  title: string;
  creator: string | null;
  year: number | null;
  type: string;
  url: string | null;
  description: string | null;
  imageUrl: string | null;
  themes: string[];
  tags: string[];
  language: string | null;
  location: string | null;
  latitude: string | null;
  longitude: string | null;
  quoteText: string | null;
  videoUrl: string | null;
  aspectRatio: string | null;
  dominantHue: number | null;
  addedBy: number | null;
  addedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Connection {
  sourceId: number;
  targetId: number;
  type: string;
  color: string;
  label?: string;
}

export type ViewMode = 'orbit' | 'index';

export const TYPE_COLORS: Record<string, string> = {
  film: 'hsl(230, 60%, 62%)',
  music: 'hsl(48, 75%, 55%)',
  book: 'hsl(20, 65%, 55%)',
  art: 'hsl(185, 60%, 48%)',
  architecture: 'hsl(280, 55%, 58%)',
  quote: 'hsl(145, 55%, 48%)',
  writing: 'hsl(30, 65%, 55%)',
  design: 'hsl(330, 58%, 56%)',
  video: 'hsl(5, 62%, 55%)',
  technology: 'hsl(210, 55%, 55%)',
  other: 'hsl(0, 0%, 55%)',
};

// Vibrant editorial connection colors (saturated, distinct)
export const CONNECTION_COLORS: Record<string, string> = {
  type: 'hsl(270, 65%, 62%)',      // Rich purple
  colour: 'hsl(38, 78%, 55%)',     // Warm amber
  theme: 'hsl(340, 68%, 58%)',     // Vivid rose
  creator: 'hsl(160, 62%, 45%)',   // Rich teal
};
