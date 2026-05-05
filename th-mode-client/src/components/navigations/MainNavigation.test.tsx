import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MainNavigation from './MainNavigation';

// Mock matchMedia to prevent Jest/Vitest error with Ant Design
window.matchMedia = window.matchMedia || function() {
    return {
        matches: false,
        addListener: function() {},
        removeListener: function() {}
    };
};

describe('MainNavigation Component', () => {
    it('renders the Leaderboard and Analytics navigation links', () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <MainNavigation />
            </MemoryRouter>
        );

        // Check for Header title
        expect(screen.getByText(/Treasure Hunt/i)).toBeInTheDocument();

        // Check for Navigation links
        expect(screen.getByText(/Leaderboard/i)).toBeInTheDocument();
        expect(screen.getByText(/Market Analytics/i)).toBeInTheDocument();
    });
});
