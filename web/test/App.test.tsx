import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../src/App';

describe('App', () => {
  it('タイトルを表示する', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'スロパチ取材 店さがし' })).toBeInTheDocument();
  });
});
