import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NFT } from '../database/entities/nft.entity';
import Redis from 'ioredis';

import { Stake } from '../database/entities/stake.entity';
import { Claim } from '../database/entities/claim.entity';

/**
 * Service responsible for business logic and data aggregation for NFTs and Analytics.
 * Implements Redis-based caching for high-performance data retrieval.
 */
@Injectable()
export class NftService {
  private readonly logger = new Logger(NftService.name);
  private redis: Redis;

  constructor(
    @InjectRepository(NFT)
    private readonly nftRepo: Repository<NFT>,
    @InjectRepository(Stake)
    private readonly stakeRepo: Repository<Stake>,
    @InjectRepository(Claim)
    private readonly claimRepo: Repository<Claim>,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  /**
   * Retrieves a paginated list of NFTs from the database with caching.
   * @param network The network to filter by ('bsc', 'polygon', or 'all').
   * @param ownerAddress Optional wallet address of the NFT owner.
   * @param cursorTokenId Cursor for pagination (token_id).
   * @param limit Number of results to return (max 100).
   */
  async getLatestNfts(network: string, ownerAddress?: string, cursorTokenId?: string, limit: number = 20) {
    const cacheKey = `nfts:${network}:${ownerAddress || 'all'}:${cursorTokenId || 'latest'}:${limit}`;
    
    // 1. Check Cache
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) {
      this.logger.debug(`Cache hit for key: ${cacheKey}`);
      return JSON.parse(cachedData);
    }

    this.logger.debug(`Cache miss for key: ${cacheKey}. Fetching from DB...`);

    // 2. Query Builder with Cursor Pagination
    const query = this.nftRepo.createQueryBuilder('nft');

    if (network && network !== 'all') {
      query.andWhere('nft.network = :network', { network });
    }

    query.orderBy('nft.token_id', 'DESC')
      .limit(limit);

    if (ownerAddress) {
      query.andWhere('nft.owner_address = :owner', { owner: ownerAddress.toLowerCase() });
    }

    if (cursorTokenId) {
      query.andWhere('nft.token_id < :cursor', { cursor: cursorTokenId });
    }

    const nfts = await query.getMany();

    // Determine the next cursor
    let nextCursor = null;
    if (nfts.length > 0) {
      nextCursor = nfts[nfts.length - 1].token_id;
    }

    const result = {
      data: nfts,
      nextCursor,
    };

    // 3. Set Cache (e.g., 5 seconds TTL for fast-moving data)
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 5);

    return result;
  }

  /**
   * Calculates the top stakers based on the number of hero NFTs they own.
   * @param limit Number of stakers to return.
   */
  async getTopStakers(limit: number = 20) {
    const cacheKey = `ranking:stakers:${limit}`;
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);

    const data = await this.nftRepo.createQueryBuilder('nft')
      .select('nft.owner_address', 'wallet')
      .addSelect('COUNT(*)', 'heroCount')
      .groupBy('nft.owner_address')
      .orderBy('COUNT(*)', 'DESC')
      .limit(limit)
      .getRawMany();

    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', 60); // Cache for 1 min
    return data;
  }

  /**
   * Aggregates top stakes by token amount and network.
   * @param token Token symbol ('bcoin' or 'sens').
   * @param network Network identifier.
   * @param limit Number of results to return.
   */
  async getTopStakes(token: string = 'bcoin', network: string = 'all', limit: number = 20) {
    const cacheKey = `ranking:stake:${token}:${network}:${limit}`;
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);

    const query = this.stakeRepo.createQueryBuilder('stake')
      .select('stake.wallet', 'wallet')
      .addSelect('SUM(stake.amount)', 'amount')
      .where('stake.token = :token', { token })
      .groupBy('stake.wallet')
      .orderBy('SUM(stake.amount)', 'DESC')
      .limit(limit);

    if (network !== 'all') {
      query.andWhere('stake.network = :network', { network });
    }

    const data = await query.getRawMany();
    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', 60);
    return data;
  }

  /**
   * Calculates global cumulative stakes across all networks and tokens.
   * @param limit Number of results to return.
   */
  async getGlobalStakes(limit: number = 20) {
    const cacheKey = `ranking:global-stake:${limit}`;
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);

    const data = await this.stakeRepo.createQueryBuilder('stake')
      .select('stake.wallet', 'wallet')
      .addSelect('SUM(stake.amount)', 'totalAmount')
      .groupBy('stake.wallet')
      .orderBy('SUM(stake.amount)', 'DESC')
      .limit(limit)
      .getRawMany();

    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', 60);
    return data;
  }

  /**
   * Aggregates top claims by token and network.
   * @param token Token symbol.
   * @param network Network identifier.
   * @param limit Number of results to return.
   */
  async getTopClaims(token: string = 'bcoin', network: string = 'all', limit: number = 20) {
    const cacheKey = `ranking:claim:${token}:${network}:${limit}`;
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);

    const query = this.claimRepo.createQueryBuilder('claim')
      .select('claim.wallet', 'wallet')
      .addSelect('SUM(claim.amount)', 'amount')
      .where('claim.token = :token', { token })
      .groupBy('claim.wallet')
      .orderBy('SUM(claim.amount)', 'DESC')
      .limit(limit);

    if (network !== 'all') {
      query.andWhere('claim.network = :network', { network });
    }

    const data = await query.getRawMany();
    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', 60);
    return data;
  }

  /**
   * Generates the real-time leaderboard data for Treasure Hunt mode.
   * Aggregates NFT rarities and links them with staking data for a unified view.
   */
  async getThLeaderboard() {
    const cacheKey = `ranking:th-leaderboard`;
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);

    // 1. Fetch all NFTs with owner addresses
    const nfts = await this.nftRepo.find();

    // 2. Fetch all stakes to map to owners
    const allStakes = await this.stakeRepo.find();

    // 3. Map stakes to wallets for fast lookup
    const walletStakes = new Map<string, { bcoin: number, sens: number }>();
    for (const stake of allStakes) {
      const current = walletStakes.get(stake.wallet) || { bcoin: 0, sens: 0 };
      if (stake.token === 'bcoin') current.bcoin += Number(stake.amount);
      if (stake.token === 'sens') current.sens += Number(stake.amount);
      walletStakes.set(stake.wallet, current);
    }

    // 4. Group by rarity
    const groupedData: any[][] = [[], [], [], [], [], []];
    const RARITY_MAP: Record<string, number> = {
      'Common': 0, 'Rare': 1, 'Super Rare': 2, 'Epic': 3, 'Legend': 4, 'Super Legend': 5
    };

    for (const nft of nfts) {
      const rarityAttr = nft.metadata?.attributes?.find((a: any) => a.trait_type === 'Rarity');
      const rarityIdx = RARITY_MAP[rarityAttr?.value] ?? 0;
      const stakes = walletStakes.get(nft.owner_address) || { bcoin: 0, sens: 0 };

      groupedData[rarityIdx].push({
        heroId: parseInt(nft.token_id),
        userName: nft.owner_address,
        heroType: 1, // Defaulting to L+ for display
        network: nft.network === 'bsc' ? 0 : 1,
        stakeBcoinFormatted: stakes.bcoin.toLocaleString(),
        stakeSenFormatted: stakes.sens.toLocaleString(),
        ticketCount: Math.floor(stakes.bcoin / 5000) + 1, // Mock ticket logic
      });
    }

    // 5. Sort each group by BCOIN stake
    for (let i = 0; i < groupedData.length; i++) {
      groupedData[i].sort((a, b) => parseFloat(b.stakeBcoinFormatted.replace(/,/g, '')) - parseFloat(a.stakeBcoinFormatted.replace(/,/g, '')));
    }

    const result = {
      raceId: 1337953, // Mirroring the screenshot
      groupedData
    };

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 30);
    return result;
  }

  /**
   * Generates a high-level summary of the entire protocol health.
   * Includes TVL equivalents and total asset distribution.
   */
  async getSummary() {
    const cacheKey = 'summary';
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [totalBsc, totalPoly] = await Promise.all([
      this.nftRepo.count({ where: { network: 'bsc' } }),
      this.nftRepo.count({ where: { network: 'polygon' } }),
    ]);

    const stakes = await this.stakeRepo.find();
    let bcoin = 0;
    let sens = 0;
    for (const s of stakes) {
      if (s.token === 'bcoin') bcoin += Number(s.amount);
      if (s.token === 'sens') sens += Number(s.amount);
    }

    const res = {
      totalStakedBcoin: bcoin,
      totalStakedSens: sens,
      totalBscNfts: totalBsc,
      totalPolygonNfts: totalPoly,
      totalAssets: totalBsc + totalPoly
    };

    await this.redis.set(cacheKey, JSON.stringify(res), 'EX', 60);
    return res;
  }

  /**
   * Retrieves full details for a specific NFT by its Token ID.
   * @param tokenId The unique ID of the NFT.
   */
  async getNftById(tokenId: string) {
    const cacheKey = `nft:detail:${tokenId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const nft = await this.nftRepo.findOne({ where: { token_id: tokenId } });
    if (nft) {
      await this.redis.set(cacheKey, JSON.stringify(nft), 'EX', 300); // Cache for 5 mins
    }
    return nft;
  }
}
