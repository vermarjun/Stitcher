import mongoose from 'mongoose';
import Template, { TemplateType } from '../model/template.model';
import { MONGODB_URL } from '../config';

/**
 * Idempotent template seed.
 *
 * Upserts a small curated set of real, public Cloudinary-hosted Manim renders
 * into the `templates` collection so the marketing landing page can fetch them
 * via GET /template/featured (a public, no-auth endpoint).
 *
 * Idempotency: each template is upserted by its `title` (the unique key on the
 * Template schema). Re-running this script updates the existing docs in place
 * instead of creating duplicates, so it is safe to run against a populated DB.
 *
 * ObjectIds are NOT hardcoded — Mongo assigns them. The landing page resolves
 * templates by querying the endpoint, never by fixed IDs.
 *
 * Run with: npm run seed:templates
 */

interface SeedTemplate {
  title: string;
  post_description: string;
  type: TemplateType;
  url: string;
  thumbnail: string;
  duration: number;
  metadata: Record<string, unknown>;
  scene_name: string;
  scene_description: string;
}

// Real renders that already live on the project's Cloudinary account.
// Thumbnails reuse the same Cloudinary asset with a video->image frame
// transform (so_2 = grab the frame at ~2s as a jpg poster).
const TEMPLATES: SeedTemplate[] = [
  {
    title: 'Lissajous Curves',
    post_description:
      'Parametric Lissajous curves traced from two sine waves at different frequencies.',
    type: TemplateType.VIDEO,
    url: 'https://res.cloudinary.com/dloh4tkp5/video/upload/v1769164127/LissajousCurves_yoz0yp.mp4',
    thumbnail:
      'https://res.cloudinary.com/dloh4tkp5/video/upload/so_2,f_jpg,w_600/v1769164127/LissajousCurves_yoz0yp.jpg',
    duration: 12,
    metadata: { category: 'math', source: 'seed', featured: true },
    scene_name: 'LissajousCurves',
    scene_description:
      'Plot a Lissajous curve by animating two perpendicular sine waves with differing frequencies and tracing the resulting path.',
  },
  {
    title: 'Mandala Pattern',
    post_description:
      'A symmetrical mandala that draws itself from the center outward in gold and purple.',
    type: TemplateType.VIDEO,
    url: 'https://res.cloudinary.com/dloh4tkp5/video/upload/v1768958348/MandalaPattern_vfemzi.mp4',
    thumbnail:
      'https://res.cloudinary.com/dloh4tkp5/video/upload/so_2,f_jpg,w_600/v1768958348/MandalaPattern_vfemzi.jpg',
    duration: 14,
    metadata: { category: 'art', source: 'seed', featured: true },
    scene_name: 'MandalaPattern',
    scene_description:
      'Create a mandala pattern that draws itself from the center outward with symmetrical petals and geometric shapes in gold and purple.',
  },
  {
    title: 'Boolean Operations',
    post_description:
      'Boolean set operations (union, intersection, difference) shown with overlapping 2D shapes.',
    type: TemplateType.VIDEO,
    url: 'https://res.cloudinary.com/dloh4tkp5/video/upload/v1761076391/BooleanOperations_bl9afi.mp4',
    thumbnail:
      'https://res.cloudinary.com/dloh4tkp5/video/upload/so_2,f_jpg,w_600/v1761076391/BooleanOperations_bl9afi.jpg',
    duration: 10,
    metadata: { category: 'math', source: 'seed', featured: true },
    scene_name: 'BooleanOperations',
    scene_description:
      'Demonstrate Boolean set operations using overlapping 2D shapes, highlighting union, intersection and difference regions.',
  },
  {
    title: 'India GDP Growth',
    post_description: 'An animated bar/line chart visualizing India GDP growth over time.',
    type: TemplateType.VIDEO,
    url: 'https://res.cloudinary.com/dloh4tkp5/video/upload/v1769164126/IndiaGDP_a8oexw.mp4',
    thumbnail:
      'https://res.cloudinary.com/dloh4tkp5/video/upload/so_2,f_jpg,w_600/v1769164126/IndiaGDP_a8oexw.jpg',
    duration: 15,
    metadata: { category: 'data', source: 'seed', featured: true },
    scene_name: 'IndiaGDP',
    scene_description:
      'Animate India GDP growth over the years as a chart that grows and labels each data point.',
  },
  {
    title: 'Euler Identity',
    post_description: 'A visual derivation of Eulers identity e^(i·pi) + 1 = 0 on the complex plane.',
    type: TemplateType.VIDEO,
    url: 'https://res.cloudinary.com/dloh4tkp5/video/upload/v1769164127/EulerIdentity_jbubvz.mp4',
    thumbnail:
      'https://res.cloudinary.com/dloh4tkp5/video/upload/so_2,f_jpg,w_600/v1769164127/EulerIdentity_jbubvz.jpg',
    duration: 13,
    metadata: { category: 'math', source: 'seed', featured: true },
    scene_name: 'EulerIdentity',
    scene_description:
      'Visualize Eulers identity by rotating a unit vector on the complex plane and arriving at e^(i·pi) + 1 = 0.',
  },
  {
    title: 'Riemann Zeta Visualization',
    post_description: 'A visualization of the Riemann zeta function in the complex plane.',
    type: TemplateType.VIDEO,
    url: 'https://res.cloudinary.com/dloh4tkp5/video/upload/v1769164455/RiemannZetaVisualization_gryhdk.mp4',
    thumbnail:
      'https://res.cloudinary.com/dloh4tkp5/video/upload/so_2,f_jpg,w_600/v1769164455/RiemannZetaVisualization_gryhdk.jpg',
    duration: 16,
    metadata: { category: 'math', source: 'seed', featured: true },
    scene_name: 'RiemannZetaVisualization',
    scene_description:
      'Visualize how the Riemann zeta function maps the complex plane, animating the domain coloring transformation.',
  },
];

async function seedTemplates() {
  try {
    console.log('Starting Template Seed...\n');
    await mongoose.connect(MONGODB_URL);
    console.log('Connected to MongoDB\n');

    let created = 0;
    let updated = 0;

    for (const tpl of TEMPLATES) {
      // Upsert by title (the unique key on the Template schema) so re-runs
      // update in place rather than duplicating.
      const result = await Template.updateOne(
        { title: tpl.title },
        { $set: tpl },
        { upsert: true }
      );

      if (result.upsertedCount && result.upsertedCount > 0) {
        created++;
        console.log(`+ created: ${tpl.title}`);
      } else {
        updated++;
        console.log(`= upserted (existing): ${tpl.title}`);
      }
    }

    const total = await Template.countDocuments({ type: TemplateType.VIDEO });

    console.log('\n' + '='.repeat(50));
    console.log('Template Seed Summary:');
    console.log('='.repeat(50));
    console.log(`Created: ${created}`);
    console.log(`Updated (already existed): ${updated}`);
    console.log(`Total video templates in DB: ${total}`);
    console.log('='.repeat(50) + '\n');

    console.log('Template seed completed successfully!\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\nTemplate seed failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seedTemplates();
