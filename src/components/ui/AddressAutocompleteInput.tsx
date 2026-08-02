'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useDebounce } from '@/hooks/useDebounce';
import { geocodingApiService, GeocodeError, type AddressSuggestion, type PlaceDetailResult } from '@/services/geocoding.service';
import { haversineDistanceKm, type LatLng } from '@/utils/geo';
import { WAREHOUSE_COORDINATES, WAREHOUSE_SURCHARGE_THRESHOLD_KM } from '@/constants/warehouse';

// Autocomplete địa chỉ qua Goong Maps — mirror đúng pattern dropdown tìm khách hàng đã có sẵn ở
// CreateOrderModal.tsx (Input gắn trực tiếp state text, gõ debounce hiện gợi ý bên dưới, click chọn điền
// giá trị + đóng dropdown, click ra ngoài tự đóng) thay vì dùng SearchableSelect.tsx (component đó theo
// mô hình "nút hiện label đã chọn", không hợp ô nhập địa chỉ tự do luôn hiển thị text đang gõ).

interface AddressAutocompleteInputProps {
  label?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  onSelectPlace: (result: PlaceDetailResult) => void;
  error?: string;
  placeholder?: string;
}

function mapErrorMessage(err: unknown): string {
  if (err instanceof GeocodeError) {
    if (err.code === 'MISSING_API_KEY') return 'Chưa cấu hình API key Goong (liên hệ quản trị hệ thống).';
    if (err.code === 'NETWORK_ERROR') return 'Không thể kết nối tới dịch vụ định vị. Vui lòng thử lại.';
    return 'Không tìm thấy địa điểm này trên bản đồ.';
  }
  return 'Không thể tải gợi ý địa chỉ.';
}

export function AddressAutocompleteInput({
  label,
  required,
  value,
  onChange,
  onSelectPlace,
  error,
  placeholder,
}: Readonly<AddressAutocompleteInputProps>) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<LatLng | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  const fieldRef = useRef<HTMLDivElement>(null);
  const debouncedValue = useDebounce(value, 400);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (fieldRef.current && !fieldRef.current.contains(e.target as Node)) setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  useEffect(() => {
    const term = debouncedValue.trim();
    if (term.length < 4 || term === resolvedAddress) {
      setSuggestions([]);
      setLocalError(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setLocalError(null);
    geocodingApiService
      .autocomplete(term, WAREHOUSE_COORDINATES)
      .then((results) => {
        if (cancelled) return;
        setSuggestions(results);
        if (results.length === 0) setLocalError('Không tìm thấy địa chỉ phù hợp.');
      })
      .catch((err) => {
        if (cancelled) return;
        setSuggestions([]);
        setLocalError(mapErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedValue, resolvedAddress]);

  const distanceKm = useMemo(() => (selectedCoords ? haversineDistanceKm(WAREHOUSE_COORDINATES, selectedCoords) : 0), [selectedCoords]);
  const showDistanceBadge = selectedCoords !== null && value === resolvedAddress;
  const isOverThreshold = distanceKm > WAREHOUSE_SURCHARGE_THRESHOLD_KM;

  const handleSelect = async (suggestion: AddressSuggestion) => {
    setIsDropdownOpen(false);
    setSuggestions([]);
    try {
      const detail = await geocodingApiService.getPlaceDetail(suggestion.placeId);
      setResolvedAddress(detail.formattedAddress);
      onChange(detail.formattedAddress);
      setSelectedCoords({ lat: detail.lat, lng: detail.lng });
      setLocalError(null);
      onSelectPlace(detail);
    } catch {
      setResolvedAddress(suggestion.description);
      onChange(suggestion.description);
      setSelectedCoords(null);
      setLocalError('Không lấy được tọa độ chính xác, vẫn dùng được địa chỉ đã chọn.');
    }
  };

  return (
    <div ref={fieldRef} className="relative">
      <Input
        label={label}
        required={required}
        error={error}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsDropdownOpen(true);
        }}
        onFocus={() => setIsDropdownOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />

      {isDropdownOpen && (isLoading || suggestions.length > 0) && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {isLoading ? (
            <p className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tìm địa chỉ...
            </p>
          ) : (
            <ul className="max-h-56 overflow-y-auto">
              {suggestions.map((s) => (
                <li key={s.placeId}>
                  <button
                    type="button"
                    onClick={() => handleSelect(s)}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-900">{s.mainText}</span>
                    {s.secondaryText && <span className="text-xs text-gray-500">{s.secondaryText}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {localError && !error && <p className="mt-1 text-xs text-slate-500">{localError}</p>}

      {showDistanceBadge && (
        <div className="mt-1.5">
          <Badge variant={isOverThreshold ? 'warning' : 'success'}>
            ~{distanceKm.toFixed(1)} km từ kho{isOverThreshold ? ' — có thể phát sinh phụ phí vận chuyển' : ''}
          </Badge>
        </div>
      )}
    </div>
  );
}

export default AddressAutocompleteInput;
