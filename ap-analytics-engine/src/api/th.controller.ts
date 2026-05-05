import { Controller, Get } from '@nestjs/common';
import { NftService } from './nft.service';

/**
 * @description Controller for official Treasure Hunt (TH) Mode operations.
 * Following Senspark's naming conventions and path structure.
 */
@Controller('th')
export class ThController {
  constructor(private readonly nftService: NftService) {}

  @Get('leaderboard')
  async getThLeaderboard() {
    return this.nftService.getThLeaderboard();
  }
}
