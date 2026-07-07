import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'https://concurrentbook.duckdns.org/api';
const TARGET_EVENT_ID = '6a3aef3e8ed346703d0b6f89';

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // ramp to 20 VUs
    { duration: '1m', target: 20 },    // hold at 20
    { duration: '30s', target: 50 },   // ramp to 50
    { duration: '1m', target: 50 },    // hold at 50
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // fail the test if p95 exceeds 1s — tune as needed
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/events?search=&sort=createdAt:-1`);
  check(res, { 'search returns 200': (r) => r.status === 200 });
  sleep(0.5);
}