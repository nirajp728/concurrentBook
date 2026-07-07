import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'https://concurrentbook.duckdns.org/api';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/events?search=&sort=createdAt:-1`);
  check(res, { 'search returns 200': (r) => r.status === 200 });
  sleep(0.5);
}