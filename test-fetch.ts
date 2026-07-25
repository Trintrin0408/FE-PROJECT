import * as crypto from 'crypto';

// Minimal JWT sign without jsonwebtoken
function base64url(str: string) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const payload = base64url(JSON.stringify({ id: 'test-user', role: 'MANAGER', exp: Math.floor(Date.now() / 1000) + 3600 }));
const signature = base64url(
  crypto.createHmac('sha256', '80be0425e20fd6ddb1c50a7e8fd0a6aaca9dfdbdfc232222c0e67084363cb941ec37546f2954850dc8e34f5cbe053428')
    .update(`${header}.${payload}`)
    .digest()
);
const token = `${header}.${payload}.${signature}`;

async function run() {
  console.log("Fetching GET /catalog/items...");
  try {
    const res = await fetch('http://localhost:3001/api/v1/catalog/items', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Body: ${text.substring(0, 500)}`);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

run();
