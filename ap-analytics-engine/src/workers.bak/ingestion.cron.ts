import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class IngestionCron {
  private readonly logger = new Logger(IngestionCron.name);

  constructor(
    @InjectQueue('ingestion-bsc') private readonly bscQueue: Queue,
    @InjectQueue('ingestion-polygon') private readonly polygonQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async triggerBscIngestion() {
    const activeJobs = await this.bscQueue.getActiveCount();
    const waitingJobs = await this.bscQueue.getWaitingCount();
    
    if (activeJobs === 0 && waitingJobs === 0) {
      await this.bscQueue.add('sync-blocks', {}, { removeOnComplete: true, removeOnFail: false });
      this.logger.debug('Job de ingestão BSC enfileirado.');
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async triggerPolygonIngestion() {
    const activeJobs = await this.polygonQueue.getActiveCount();
    const waitingJobs = await this.polygonQueue.getWaitingCount();
    
    if (activeJobs === 0 && waitingJobs === 0) {
      await this.polygonQueue.add('sync-blocks', {}, { removeOnComplete: true, removeOnFail: false });
      this.logger.debug('Job de ingestão Polygon enfileirado.');
    }
  }
}
