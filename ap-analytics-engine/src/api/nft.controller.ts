import { Controller, Get, Query, BadRequestException, Param } from '@nestjs/common';
import { NftService } from './nft.service';

/**
 * Controller responsible for handling NFT and Analytics related requests.
 * All routes are prefixed with 'nfts'.
 */
@Controller('nfts')
export class NftController {
  constructor(private readonly nftService: NftService) {}

  /**
   * Retrieves a global summary of protocol statistics.
   * Includes total assets, token prices, and cumulative metrics.
   */
  @Get('overview-stats')
  async getOverviewStats() {
    return this.nftService.getSummary();
  }

  /**
   * Retrieves the ranking of users with the most heroes staked.
   * @param limit Number of records to return (default: 20).
   */
  @Get('ranking/stakers')
  async getTopStakers(@Query('limit') limit: number = 20) {
    return this.nftService.getTopStakers(limit);
  }

  /**
   * Retrieves the ranking of top stakers by token amount.
   * @param token Token symbol to filter by ('bcoin' or 'sens').
   * @param network Network filter ('bsc', 'polygon', or 'all').
   * @param limit Number of records to return (default: 20).
   */
  @Get('ranking/stake')
  async getTopStakes(
    @Query('token') token: string = 'bcoin',
    @Query('network') network: string = 'all',
    @Query('limit') limit: number = 20,
  ) {
    return this.nftService.getTopStakes(token, network, limit);
  }

  /**
   * Retrieves the global ranking of cumulative stakes across all networks.
   * @param limit Number of records to return (default: 20).
   */
  @Get('ranking/global-stake')
  async getGlobalStakes(@Query('limit') limit: number = 20) {
    return this.nftService.getGlobalStakes(limit);
  }

  /**
   * Retrieves the ranking of top claimers by token amount.
   * @param token Token symbol to filter by ('bcoin' or 'sens').
   * @param network Network filter ('bsc', 'polygon', or 'all').
   * @param limit Number of records to return (default: 10).
   */
  @Get('ranking/claim')
  async getTopClaims(
    @Query('token') token: string = 'bcoin',
    @Query('network') network: string = 'all',
    @Query('limit') limit: any = 10
  ) {
    const parsedLimit = parseInt(limit.toString(), 10) || 10;
    return this.nftService.getTopClaims(token, network, parsedLimit);
  }

  /**
   * Retrieves the real-time leaderboard for the Treasure Hunt mode.
   */
  @Get('th/leaderboard')
  async getThLeaderboard() {
    return this.nftService.getThLeaderboard();
  }

  /**
   * Retrieves a paginated list of NFTs with optional filtering by network or owner.
   * @param network Network filter ('bsc', 'polygon', or 'all').
   * @param ownerAddress Optional wallet address to filter assets.
   * @param cursor Optional pagination cursor.
   * @param limit Number of records per page (max 100, default: 20).
   */
  @Get()
  async getLatestNfts(
    @Query('network') network: string = 'all',
    @Query('owner') ownerAddress?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    const parsedLimit = limit ? Math.min(parseInt(limit.toString(), 10), 100) : 20;
    return this.nftService.getLatestNfts(network, ownerAddress, cursor, parsedLimit);
  }

  /**
   * Retrieves detailed information for a single NFT by its Token ID.
   * @param id The Token ID of the NFT.
   */
  @Get(':id')
  async getNftById(@Param('id') id: string) {
    const nft = await this.nftService.getNftById(id);
    if (!nft) {
      throw new BadRequestException('NFT not found');
    }
    return nft;
  }
}
