import { catalogApiService } from './src/services/catalog.service';
import api from './src/services/api';
import jwt from 'jsonwebtoken';

// Disable mock mode if needed
process.env.NEXT_PUBLIC_MOCK_MODE = 'false';
process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3001/api/v1';

const JWT_SECRET = '80be0425e20fd6ddb1c50a7e8fd0a6aaca9dfdbdfc232222c0e67084363cb941ec37546f2954850dc8e34f5cbe053428';

// Create a mock token for MANAGER
const token = jwt.sign({ id: 'test-user', role: 'MANAGER' }, JWT_SECRET, { expiresIn: '1h' });

api.interceptors.request.use((config) => {
  if (config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

async function test() {
  try {
    console.log('Sending request GET /catalog/items without parameters');
    const data = await catalogApiService.getItems();
    console.log('Success:', data.meta);
    
    console.log('Sending request GET /catalog/items with { page: "", limit: "" }');
    const data2 = await catalogApiService.getItems({ page: '' as any, limit: '' as any });
    console.log('Success:', data2.meta);
  } catch (error: any) {
    console.error('Error Status:', error.response?.status);
    console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('Error Config Params:', error.config?.params);
  }
}

test();
