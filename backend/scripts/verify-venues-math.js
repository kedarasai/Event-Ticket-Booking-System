/**
 * verify-venues-math.js
 * Comprehensive mathematical and geometric validation of venue seating plans.
 */

// We can import the primitives and templates by transpiling or evaluating them in Node (they are ES modules)
async function run() {
  console.log('================================================================');
  console.log('VENUE SEATING PLAN MATHEMATICAL & GEOMETRIC VERIFICATION');
  console.log('================================================================\n');

  const { VENUE_TEMPLATES, getTemplate } = await import('../../frontend/src/seatmap/templates.js');
  const { getSeatLayout } = await import('../../frontend/src/seatmap/seatLayout.js');
  const { calculateArcSpan, interpolateArcAngle } = await import('../../frontend/src/seatmap/primitives.js');

  // 1. Verify North Stand Bearing Wrap (310 to 50)
  console.log('--- 1. North Stand Bearing Wrap Verification (310° to 50°) ---');
  const arcResult = calculateArcSpan(310, 50);
  const span = arcResult.span;
  console.log(`Arc span from 310° to 50°: ${span}° (isWrap: ${arcResult.isWrap}, Expected: 100°)`);
  if (span !== 100 || !arcResult.isWrap) {
    throw new Error(`Invalid arc span calculation: ${JSON.stringify(arcResult)}`);
  }

  const angles = [0, 0.25, 0.5, 0.75, 1.0].map((t) => interpolateArcAngle(310, 50, t));
  console.log(`Interpolated angles across [0, 0.25, 0.5, 0.75, 1.0]:`);
  console.log(`  t=0.00 -> ${angles[0].toFixed(1)}° (Expected: 310.0°)`);
  console.log(`  t=0.25 -> ${angles[1].toFixed(1)}° (Expected: 335.0°)`);
  console.log(`  t=0.50 -> ${angles[2].toFixed(1)}° (Expected: 360.0° / 0.0°)`);
  console.log(`  t=0.75 -> ${angles[3].toFixed(1)}° (Expected: 25.0°)`);
  console.log(`  t=1.00 -> ${angles[4].toFixed(1)}° (Expected: 50.0°)`);

  if (Math.abs(angles[0] - 310) > 0.01 || Math.abs(angles[4] - 50) > 0.01) {
    throw new Error('Bearing wrap boundary interpolation failed!');
  }
  console.log('[PASS] North Stand bearing wrap verified successfully!\n');

  // 2. Verify all 6 venue templates & zero overlaps
  console.log('--- 2. Venue Templates & Collision Check (Min Distance >= 16px) ---');
  const venueKeys = ['ARENA', 'AUDITORIUM', 'CLUB', 'THEATRE', 'STADIUM', 'FESTIVAL'];
  const expectedCounts = {
    ARENA: 138,
    AUDITORIUM: 128,
    CLUB: 40,
    THEATRE: 144,
    STADIUM: 126,
    FESTIVAL: 138
  };

  const MIN_SEAT_DISTANCE = 16; // px

  for (const key of venueKeys) {
    const template = getTemplate(key);
    const slots = template.generatePositions();
    console.log(`Checking [${key}] - ${template.name}:`);
    console.log(`  Generated slots: ${slots.length} (Expected: ${expectedCounts[key]})`);

    if (slots.length !== expectedCounts[key]) {
      throw new Error(`Slot count mismatch for ${key}: got ${slots.length}, expected ${expectedCounts[key]}`);
    }

    // Check overlaps
    let collisions = 0;
    let minObservedDist = Infinity;

    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const dx = slots[i].x - slots[j].x;
        const dy = slots[i].y - slots[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minObservedDist) minObservedDist = dist;
        if (dist < MIN_SEAT_DISTANCE) {
          collisions++;
          console.error(`  COLLISION between ${slots[i].rowLabel}-${slots[i].colNumber} (${slots[i].section}) and ${slots[j].rowLabel}-${slots[j].colNumber} (${slots[j].section}): dist=${dist.toFixed(2)}px`);
        }
      }
    }

    console.log(`  Min observed seat spacing: ${minObservedDist.toFixed(1)}px (Threshold: ${MIN_SEAT_DISTANCE}px)`);
    console.log(`  Overlaps/collisions: ${collisions}`);
    if (collisions > 0) {
      throw new Error(`Detected ${collisions} collisions in ${key}!`);
    }

    // Verify sections
    const sections = [...new Set(slots.map((s) => s.section))];
    console.log(`  Sections (${sections.length}): ${sections.join(', ')}`);
    console.log(`  Decor count: ${template.decor.length} items`);
    console.log(`  [PASS] ${key} is valid and collision-free.\n`);
  }

  console.log('================================================================');
  console.log('[SUCCESS] ALL 6 VENUES VERIFIED WITH ZERO COLLISIONS!');
  console.log('================================================================');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
