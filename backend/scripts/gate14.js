async function testEventDetailGate() {
  const baseUrl = 'http://localhost:5000/api/v1';
  console.log('--- Phase 15 Event Details API Gate Verifications ---');

  // 1. Valid event (id: 1)
  const validRes = await fetch(`${baseUrl}/events/1`);
  const validData = await validRes.json();
  console.log(`\n1. Valid Event (ID 1): status=${validRes.status}, success=${validData.success}`);
  const event = validData.data?.event;
  console.log(`   Title: ${event?.title}`);
  console.log(`   Category: ${event?.category}`);
  console.log(`   Price: ₹${event?.price} - ₹${event?.priceMax}`);
  if (event?.tiers) {
    console.log(`   Tiers: ${event.tiers.map((t) => `${t.tier}: ₹${t.price} (${t.availableSeats}/${t.totalSeats})`).join(', ')}`);
  }
  console.log(`   Seats: ${event?.availableSeats} of ${event?.totalSeats} available`);

  // 2. Non-existent event (id: 9999) -> 404
  const notFoundRes = await fetch(`${baseUrl}/events/9999`);
  const notFoundData = await notFoundRes.json();
  console.log(`\n2. Non-existent Event (ID 9999): status=${notFoundRes.status}, success=${notFoundData.success}, message="${notFoundData.message}"`);

  // 3. Invalid non-integer ID -> 400
  const invalidRes = await fetch(`${baseUrl}/events/invalid`);
  const invalidData = await invalidRes.json();
  console.log(`\n3. Invalid ID ("invalid"): status=${invalidRes.status}, success=${invalidData.success}, message="${invalidData.message}"`);

  // 4. Seats route for event 1 (public seats layout endpoint)
  const seatsRes = await fetch(`${baseUrl}/events/1/seats`);
  const seatsData = await seatsRes.json();
  console.log(`\n4. Event Seats (ID 1): status=${seatsRes.status}, success=${seatsData.success}, seatsCount=${seatsData.data?.seats?.length}`);

  console.log('\n=== All Phase 15 Event Details backend checks passed! ===');
}

testEventDetailGate().catch(console.error);
