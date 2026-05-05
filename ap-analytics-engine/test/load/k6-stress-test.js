import http from 'k6/http';
import { check, sleep } from 'k6';

// Run with: k6 run test/load/k6-stress-test.js
export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp-up to 50 users
    { duration: '1m', target: 50 },   // Stay at 50 users for 1 minute
    { duration: '30s', target: 100 }, // Spike to 100 users
    { duration: '30s', target: 0 },   // Ramp-down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests must complete below 200ms
  },
};

export default function () {
  // Test both networks
  const networks = ['bsc', 'polygon'];
  const network = networks[Math.floor(Math.random() * networks.length)];
  
  // Hit the endpoint
  const res = http.get(`http://localhost:3000/nfts?network=${network}`);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has data array': (r) => JSON.parse(r.body).data !== undefined,
  });
  
  sleep(1);
}
