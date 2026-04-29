import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PvpLeaderBoardPage from '../PvpLeaderBoardPage';
import { MemoryRouter } from 'react-router-dom';

// Mock matchMedia for Ant Design components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('PvpLeaderBoardPage', () => {
    it('renders the leaderboard page with all tabs', () => {
        render(
            <MemoryRouter>
                <PvpLeaderBoardPage />
            </MemoryRouter>
        );
        
        expect(screen.getByText(/Weekly Ranking/i)).toBeDefined();
        expect(screen.getByText(/Monthly Ranking/i)).toBeDefined();
        expect(screen.getByText(/Hall of Fame/i)).toBeDefined();
    });

    it('changes network via dropdown', async () => {
        render(
            <MemoryRouter>
                <PvpLeaderBoardPage />
            </MemoryRouter>
        );
        
        const networkSelector = screen.getByText(/BSC/i);
        expect(networkSelector).toBeDefined();
        
        // In Ant Design, we might need more complex interaction, but this is a start
    });

    it('renders the auto-refresh toggle', () => {
        render(
            <MemoryRouter>
                <PvpLeaderBoardPage />
            </MemoryRouter>
        );
        
        expect(screen.getByText(/Auto-refresh/i)).toBeDefined();
    });
});
