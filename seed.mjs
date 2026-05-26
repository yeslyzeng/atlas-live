import { readFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/mysql2';
import { resources } from './drizzle/schema.ts';
import 'dotenv/config';

const data = JSON.parse(readFileSync('./client/src/data/resources.json', 'utf-8'));

const db = drizzle(process.env.DATABASE_URL);

async function seed() {
  console.log(`Seeding ${data.length} resources...`);
  
  for (const r of data) {
    await db.insert(resources).values({
      title: r.title,
      creator: r.creator || null,
      year: r.year || null,
      type: r.type || 'other',
      url: r.url || null,
      description: r.description || null,
      imageUrl: r.imageUrl || null,
      themes: Array.isArray(r.themes) ? JSON.stringify(r.themes) : (r.themes || null),
      tags: Array.isArray(r.tags) ? JSON.stringify(r.tags) : (r.tags || null),
      language: r.language || null,
      location: r.location || null,
      latitude: r.latitude || null,
      longitude: r.longitude || null,
      quoteText: r.quoteText || null,
      videoUrl: r.videoUrl || null,
      aspectRatio: r.aspectRatio ? String(r.aspectRatio) : null,
      dominantHue: r.dominantHue || null,
      addedBy: r.addedBy || null,
      addedAt: r.addedAt ? new Date(r.addedAt) : null,
    });
  }
  
  console.log('Done!');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
