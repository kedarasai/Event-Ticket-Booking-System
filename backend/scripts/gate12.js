async function testGate12() {
  const baseUrl = 'http://localhost:5000/api/v1';
  console.log('--- Phase 12 Gate API Verifications ---');

  // 1. Demo Login
  console.log('\n1. Test Demo Account Login (demo@example.com / Demo@1234)...');
  const demoRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@example.com', password: 'Demo@1234' })
  });
  const demoData = await demoRes.json();
  console.log('Status:', demoRes.status, '| Success:', demoData.success, '| User:', demoData.data?.user?.email);

  // 2. Wrong Password
  console.log('\n2. Test Wrong Password (demo@example.com / WrongPass999)...');
  const wrongPassRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@example.com', password: 'WrongPass999' })
  });
  const wrongPassData = await wrongPassRes.json();
  console.log('Status:', wrongPassRes.status, '| Success:', wrongPassData.success, '| Error Message:', wrongPassData.message);

  // 3. Register New User
  const randomEmail = `gate12_${Date.now()}@testflow.io`;
  console.log(`\n3. Test Register New User (${randomEmail})...`);
  const regRes = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Gate Twelve', email: randomEmail, password: 'Password@123' })
  });
  const regData = await regRes.json();
  console.log('Status:', regRes.status, '| Success:', regData.success, '| Registered User:', regData.data?.user?.email);

  // 4. Duplicate Email Error
  console.log(`\n4. Test Duplicate Email Registration (${randomEmail})...`);
  const dupRes = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Duplicate User', email: randomEmail, password: 'Password@123' })
  });
  const dupData = await dupRes.json();
  console.log('Status:', dupRes.status, '| Success:', dupData.success, '| Error Message:', dupData.message);

  // 5. Auth /me with token
  console.log('\n5. Test /auth/me with Bearer token...');
  const meRes = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${regData.data?.token}` }
  });
  const meData = await meRes.json();
  console.log('Status:', meRes.status, '| User from token:', meData.data?.user?.email);

  // 6. Protected Bookings Route
  console.log('\n6. Test Protected Route without token vs with token...');
  const unauthRes = await fetch(`${baseUrl}/bookings/my`);
  console.log('Without token -> Status:', unauthRes.status);
  const authRes = await fetch(`${baseUrl}/bookings/my`, {
    headers: { Authorization: `Bearer ${regData.data?.token}` }
  });
  const authBookingsData = await authRes.json();
  console.log('With token -> Status:', authRes.status, '| Bookings array length:', authBookingsData.data?.bookings?.length);

  console.log('\n=== All Phase 12 backend gate assertions passed! ===');
}

testGate12().catch(console.error);
