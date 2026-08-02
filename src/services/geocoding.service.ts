// Gọi THẲNG Goong Maps Place Autocomplete/Place Detail REST API từ trình duyệt — KHÔNG qua `api.ts`
// (không có JWT, không phải backend thật của dự án). Cùng cách tiếp cận đã có tiền lệ ở
// `src/constants/company-bank.ts` (buildVietQrImageUrl gọi thẳng img.vietqr.io). Dùng để gợi ý/xác nhận
// địa chỉ khi tạo đơn hàng rồi lấy tọa độ gửi xuống `POST /orders` (`orders.latitude/longitude` — backend
// thật đã hỗ trợ sẵn 2 cột này từ tính năng GPS check-in, chỉ chưa có nơi nào ở FE từng gửi lên).

export interface AddressSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetailResult {
  formattedAddress: string;
  lat: number;
  lng: number;
}

export type GeocodeErrorCode = 'MISSING_API_KEY' | 'NETWORK_ERROR' | 'NOT_FOUND';

export class GeocodeError extends Error {
  code: GeocodeErrorCode;
  constructor(code: GeocodeErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'GeocodeError';
  }
}

const GOONG_BASE_URL = 'https://rsapi.goong.io';

function getApiKey(): string {
  const key = process.env.NEXT_PUBLIC_GOONG_API_KEY;
  if (!key) {
    throw new GeocodeError('MISSING_API_KEY', 'Chưa cấu hình NEXT_PUBLIC_GOONG_API_KEY');
  }
  return key;
}

async function fetchJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new GeocodeError('NETWORK_ERROR', 'Không thể kết nối tới dịch vụ định vị');
  }
  if (!response.ok) {
    throw new GeocodeError('NETWORK_ERROR', 'Không thể kết nối tới dịch vụ định vị');
  }
  return response.json();
}

interface GoongAutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
}

interface GoongAutocompleteResponse {
  predictions: GoongAutocompletePrediction[];
  status: string;
}

interface GoongPlaceDetailResponse {
  result?: {
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
  };
  status: string;
}

export const geocodingApiService = {
  /** GET https://rsapi.goong.io/place/autocomplete — gợi ý địa chỉ theo chuỗi gõ tay, ưu tiên kết quả
   * gần `biasLocation` (nếu có). */
  async autocomplete(input: string, biasLocation?: { lat: number; lng: number }): Promise<AddressSuggestion[]> {
    const apiKey = getApiKey();
    const params = new URLSearchParams({ input, api_key: apiKey });
    if (biasLocation) params.set('location', `${biasLocation.lat},${biasLocation.lng}`);

    const data = (await fetchJson(`${GOONG_BASE_URL}/place/autocomplete?${params.toString()}`)) as GoongAutocompleteResponse;
    if (data.status !== 'OK') return [];

    return (data.predictions ?? []).map((p) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text ?? p.description,
      secondaryText: p.structured_formatting?.secondary_text ?? '',
    }));
  },

  /** GET https://rsapi.goong.io/place/detail — lấy địa chỉ chuẩn hóa + tọa độ từ 1 place_id đã chọn. */
  async getPlaceDetail(placeId: string): Promise<PlaceDetailResult> {
    const apiKey = getApiKey();
    const params = new URLSearchParams({ place_id: placeId, api_key: apiKey });

    const data = (await fetchJson(`${GOONG_BASE_URL}/place/detail?${params.toString()}`)) as GoongPlaceDetailResponse;
    if (data.status !== 'OK' || !data.result) {
      throw new GeocodeError('NOT_FOUND', 'Không tìm thấy thông tin chi tiết cho địa điểm này');
    }

    return {
      formattedAddress: data.result.formatted_address,
      lat: data.result.geometry.location.lat,
      lng: data.result.geometry.location.lng,
    };
  },
};
