'use client';

import { useCallback, useEffect, useState } from 'react';

export interface AsyncData<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Tải 1 nguồn dữ liệu ĐỘC LẬP (mỗi khối báo cáo tự dùng 1 hook riêng → shimmer riêng, không chờ nhau).
 * Tự chạy lại khi `deps` đổi (vd đổi khoảng ngày filter). Bỏ qua kết quả cũ nếu deps đổi giữa chừng.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncData<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcher()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(e instanceof Error ? e.message : 'Đã xảy ra lỗi');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // fetcher cố ý không nằm trong deps — người gọi kiểm soát refetch qua `deps`/reload (tránh vòng lặp
    // do fetcher là closure mới mỗi render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, reload };
}
