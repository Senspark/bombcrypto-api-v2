import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AnalyticsPage from './AnalyticsPage';
import axios from 'axios';
import { vi } from 'vitest';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const MOCK_NFT_BSC = {
    id: 1,
    token_id: '1234',
    network: 'bsc',
    contract_address: '0x123',
    metadata: { attributes: [{ trait_type: 'Rarity', value: 'Rare' }] },
    owner_address: '0xabc12300000000000000000000000000deadbeef',
    block_number: 40100,
    created_at: new Date().toISOString(),
};

const MOCK_NFT_POLYGON = {
    id: 2,
    token_id: '5678',
    network: 'polygon',
    contract_address: '0x456',
    metadata: { attributes: [{ trait_type: 'Rarity', value: 'Epic' }] },
    owner_address: '0xdef45600000000000000000000000000cafebabe',
    block_number: 55200,
    created_at: new Date().toISOString(),
};

describe('AnalyticsPage Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the Market Analytics title and filter controls', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: { data: [] } });
        render(<AnalyticsPage />);

        expect(screen.getByText('Market Analytics')).toBeInTheDocument();
        expect(screen.getByText('Live Asset Feed')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search Token ID...')).toBeInTheDocument();
    });

    it('displays data with community-aligned rarity colors after loading', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: { data: [MOCK_NFT_BSC, MOCK_NFT_POLYGON] },
        });

        render(<AnalyticsPage />);

        // Wait for data to be loaded and rendered
        await waitFor(() => {
            expect(screen.getByText('#1234')).toBeInTheDocument();
        });

        // Verify both NFTs rendered
        expect(screen.getByText('#5678')).toBeInTheDocument();

        // Check if statistics are updated
        expect(screen.getByText('BSC Indexed NFTs')).toBeInTheDocument();
        expect(screen.getByText('Polygon Indexed NFTs')).toBeInTheDocument();

        // Check rarity tags rendered with community labels
        expect(screen.getByText('Rare')).toBeInTheDocument();
        expect(screen.getByText('Epic')).toBeInTheDocument();

        // Verify Rare tag uses HERO_COLORS[1] = #3bca22
        const rareTag = screen.getByText('Rare');
        expect(rareTag).toHaveStyle({ background: '#3bca22' });

        // Verify Epic tag uses HERO_COLORS[3] = #ff00ee
        const epicTag = screen.getByText('Epic');
        expect(epicTag).toHaveStyle({ background: '#ff00ee' });
    });

    it('filters by Token ID search input', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: { data: [MOCK_NFT_BSC, MOCK_NFT_POLYGON] },
        });

        render(<AnalyticsPage />);

        await waitFor(() => {
            expect(screen.getByText('#1234')).toBeInTheDocument();
        });

        // Type in the search box to filter
        const searchInput = screen.getByPlaceholderText('Search Token ID...');
        fireEvent.change(searchInput, { target: { value: '1234' } });

        // After filtering, only BSC NFT should be visible
        expect(screen.getByText('#1234')).toBeInTheDocument();
        expect(screen.queryByText('#5678')).not.toBeInTheDocument();

        // Result counter should show 1
        expect(screen.getByText('1 results')).toBeInTheDocument();
    });
});

