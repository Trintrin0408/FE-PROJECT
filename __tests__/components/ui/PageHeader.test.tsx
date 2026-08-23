import { render, screen } from '@testing-library/react';
import { PageHeader } from '@/components/ui/PageHeader';

describe('PageHeader', () => {
  it('render tiêu đề dạng h1', () => {
    render(<PageHeader title="Quản lý báo giá" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Quản lý báo giá' })).toBeInTheDocument();
  });

  it('render mô tả khi có description', () => {
    render(<PageHeader title="Khách hàng" description="Quản lý hồ sơ khách hàng." />);
    expect(screen.getByText('Quản lý hồ sơ khách hàng.')).toBeInTheDocument();
  });

  it('render breadcrumb khi có', () => {
    render(<PageHeader title="Chi tiết đơn" breadcrumb={[{ label: 'Đơn hàng', href: '/manager/orders' }, { label: 'ORD-001' }]} />);
    expect(screen.getByText('Đơn hàng')).toBeInTheDocument();
    expect(screen.getByText('ORD-001')).toBeInTheDocument();
  });

  it('render nút quay lại khi có backHref', () => {
    render(<PageHeader title="Chi tiết đơn" backHref="/manager/orders" />);
    expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/manager/orders');
  });

  it('render actions khi có', () => {
    render(<PageHeader title="Khách hàng" actions={<button type="button">Thêm khách hàng</button>} />);
    expect(screen.getByRole('button', { name: 'Thêm khách hàng' })).toBeInTheDocument();
  });

  it('render icon cạnh tiêu đề khi có', () => {
    render(<PageHeader title="Công việc" icon={<svg data-testid="page-icon" />} />);
    expect(screen.getByTestId('page-icon')).toBeInTheDocument();
  });
});
