import '@testing-library/jest-dom';

// jsdom chưa hỗ trợ IntersectionObserver — framer-motion (dùng trong Reveal.tsx cho scroll-reveal,
// bọc bởi FilterBar và nhiều component khác) cần API này để mount trong test. Polyfill tối thiểu
// để render được, không giả lập hành vi observe thật (test không cần kiểm tra thời điểm reveal).
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {
    // no-op: test không cần kiểm tra thời điểm phần tử vào viewport
  }
  unobserve() {
    // no-op
  }
  disconnect() {
    // no-op
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
