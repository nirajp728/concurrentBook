import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = 'https://concurrentbook.duckdns.org/api';
const USER_COUNT = 50;
const TARGET_EVENT_ID = '6a3aef3e8ed346703d0b6f89';
const TARGET_SEAT = 'A1';

const successCount = new Counter('booking_success');
const conflictCount = new Counter('booking_conflict');
const unexpectedCount = new Counter('booking_unexpected');

export const options = {
  vus: USER_COUNT,
  iterations: USER_COUNT,
};

export function setup() {
  const tokens = [];
  for (let i = 0; i < USER_COUNT; i++) {
    const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      email: `loadtest${i}@test.com`,
      password: 'TestPass123!'
    }), { headers: { 'Content-Type': 'application/json' } });
    const body = JSON.parse(res.body);
    tokens.push(body.token);
  }
  return { tokens };
}

export default function (data) {
  const token = data.tokens[__VU - 1];

  const res = http.post(`${BASE_URL}/bookings/create-payment-intent`, JSON.stringify({
    eventId: TARGET_EVENT_ID,
    seats: [TARGET_SEAT],
    idempotencyKey: `race-${__VU}-${Date.now()}`
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (res.status === 200) {
    successCount.add(1);
  } else if (res.status === 409) {
    conflictCount.add(1);
  } else {
    unexpectedCount.add(1);
    console.log(`VU ${__VU} unexpected status ${res.status}: ${res.body}`);
  }

  check(res, {
    'status is 200 or 409': (r) => r.status === 200 || r.status === 409,
  });
}