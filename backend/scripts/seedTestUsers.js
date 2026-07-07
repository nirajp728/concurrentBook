import axios from 'axios';

const BASE_URL = 'https://concurrentbook.duckdns.org/api';
const USER_COUNT = 50;

async function seed() {
  for (let i = 0; i < USER_COUNT; i++) {
    try {
      await axios.post(`${BASE_URL}/auth/register`, {
        name: `LoadTestUser${i}`,
        email: `loadtest${i}@test.com`,
        password: 'TestPass123!'
      });
      console.log(`Created loadtest${i}@test.com`);
    } catch (e) {
      console.log(`Skipped loadtest${i}: ${e.response?.data?.message || e.message}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }
  console.log('Done seeding test users.');
}

seed();