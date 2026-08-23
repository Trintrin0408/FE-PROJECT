import { render, screen } from '@testing-library/react';
import { FilterBar, FilterRow } from '@/components/ui/FilterBar';

describe('FilterBar', () => {
  it('render children bên trong', () => {
    render(
      <FilterBar>
        <p>Nội dung filter</p>
      </FilterBar>,
    );
    expect(screen.getByText('Nội dung filter')).toBeInTheDocument();
  });
});

describe('FilterRow', () => {
  it('render children với layout mặc định', () => {
    render(
      <FilterRow>
        <span>Control 1</span>
      </FilterRow>,
    );
    expect(screen.getByText('Control 1')).toBeInTheDocument();
  });
});
