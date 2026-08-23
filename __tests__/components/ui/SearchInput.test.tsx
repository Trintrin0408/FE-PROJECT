import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchInput } from '@/components/ui/SearchInput';

describe('SearchInput', () => {
  it('hiển thị giá trị và gọi onChange với chuỗi (không phải event)', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(<SearchInput value="" onChange={handleChange} placeholder="Tìm theo tên..." />);

    const input = screen.getByPlaceholderText('Tìm theo tên...');
    await user.type(input, 'a');

    expect(handleChange).toHaveBeenCalledWith('a');
  });

  it('không hiện nút xoá khi không truyền onClear', () => {
    render(<SearchInput value="abc" onChange={jest.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('hiện nút xoá khi có onClear và value khác rỗng, và gọi đúng khi bấm', async () => {
    const user = userEvent.setup();
    const handleClear = jest.fn();
    render(<SearchInput value="abc" onChange={jest.fn()} onClear={handleClear} />);

    const clearButton = screen.getByRole('button');
    await user.click(clearButton);

    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it('không hiện nút xoá khi value rỗng dù có truyền onClear', () => {
    render(<SearchInput value="" onChange={jest.fn()} onClear={jest.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
