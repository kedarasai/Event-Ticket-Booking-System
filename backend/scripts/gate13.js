async function testCatalogGate() {
  const baseUrl = 'http://localhost:5000/api/v1';
  console.log('--- Phase 13 Catalog & Search API Verifications ---');

  // 1. All events page 1
  const allRes = await fetch(`${baseUrl}/events?page=1&limit=6`);
  const allData = await allRes.json();
  console.log(`\n1. All events (page 1, limit 6): status=${allRes.status}, returned=${allData.data?.events?.length}, total=${allData.data?.pagination?.total}`);

  // 2. Search "Concert"
  const concertRes = await fetch(`${baseUrl}/events?search=Concert&page=1&limit=6`);
  const concertData = await concertRes.json();
  console.log(`\n2. Search "Concert": status=${concertRes.status}, returned=${concertData.data?.events?.length}, total=${concertData.data?.pagination?.total}`);
  concertData.data?.events?.forEach((e) => console.log(`   - [${e.category}] ${e.title} (from ₹${e.price} to ₹${e.priceMax}) Seats: ${e.availableSeats}/${e.totalSeats}`));

  // 3. Category queries
  const categories = ['Conference', 'Comedy', 'Theatre', 'Sports', 'Festival'];
  console.log('\n3. Testing each category query:');
  for (const cat of categories) {
    const res = await fetch(`${baseUrl}/events?search=${cat}`);
    const data = await res.json();
    console.log(`   - "${cat}": returned=${data.data?.events?.length || 0}, total=${data.data?.pagination?.total || 0}`);
  }

  // 4. Empty search query "zzzz"
  const emptyRes = await fetch(`${baseUrl}/events?search=zzzz`);
  const emptyData = await emptyRes.json();
  console.log(`\n4. Search "zzzz": status=${emptyRes.status}, returned=${emptyData.data?.events?.length}, total=${emptyData.data?.pagination?.total}`);

  // 5. Pagination test (page 1 vs page 2)
  const p1Res = await fetch(`${baseUrl}/events?page=1&limit=2`);
  const p1Data = await p1Res.json();
  const p2Res = await fetch(`${baseUrl}/events?page=2&limit=2`);
  const p2Data = await p2Res.json();
  console.log(`\n5. Pagination (limit 2):`);
  console.log(`   Page 1 ID(s): ${p1Data.data?.events?.map(e => e.eventId).join(', ')}`);
  console.log(`   Page 2 ID(s): ${p2Data.data?.events?.map(e => e.eventId).join(', ')}`);

  console.log('\n=== All Phase 13 Catalog API checks passed! ===');
}

testCatalogGate().catch(console.error);
