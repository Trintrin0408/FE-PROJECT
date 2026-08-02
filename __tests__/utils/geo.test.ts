import { haversineDistanceKm } from '@/utils/geo';

describe('haversineDistanceKm', () => {
  it('trả về 0 khi 2 tọa độ trùng nhau', () => {
    const point = { lat: 10.7769, lng: 106.7009 };
    expect(haversineDistanceKm(point, point)).toBeCloseTo(0, 5);
  });

  it('tính đúng khoảng cách xấp xỉ giữa Hà Nội và TP.HCM (~1140-1160km đường chim bay)', () => {
    const hanoi = { lat: 21.0285, lng: 105.8542 };
    const hcmc = { lat: 10.7769, lng: 106.7009 };
    const distance = haversineDistanceKm(hanoi, hcmc);
    expect(distance).toBeGreaterThan(1100);
    expect(distance).toBeLessThan(1200);
  });

  it('đối xứng — khoảng cách A→B bằng B→A', () => {
    const a = { lat: 10.7769, lng: 106.7009 };
    const b = { lat: 10.8231, lng: 106.6297 };
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 10);
  });
});
