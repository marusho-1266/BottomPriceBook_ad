import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';

describe('App', () => {
  it('アプリ名「そこねこ」をヘッダーに表示する', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'そこねこ' })).toBeInTheDocument();
  });
});
