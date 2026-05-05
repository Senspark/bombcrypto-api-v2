import { HeroUpdateQueue } from '@/modules/hero/processors/hero-update';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { Queue } from 'bullmq';

@Module({})
export class QueuesModule implements NestModule {
  static register(): DynamicModule {
    const extensionMessage = BullModule.registerQueue({
      name: 'extension-message',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    });
    const heroUpdate = BullModule.registerQueue({
      name: 'hero-update',
      defaultJobOptions: {
        //removeOnComplete: true,
        removeOnFail: false,
        attempts: 2,
      },
    });
    const houseUpdate = BullModule.registerQueue({
      name: 'house-update',
      defaultJobOptions: {
        //removeOnComplete: true,
        removeOnFail: false,
      },
    });
    const CronEveryHour = BullModule.registerQueue({
      name: 'cron-every-hour',
      defaultJobOptions: {
        //removeOnComplete: true,
        removeOnFail: false,
        attempts: 2,
      },
    });
    const webhookQuicknode = BullModule.registerQueue({
      name: 'webhook-quicknode',
      defaultJobOptions: {
        //removeOnComplete: true,
        removeOnFail: false,
      },
    });
    const onHeroRetail = BullModule.registerQueue({
      name: 'on-hero-retail',
      defaultJobOptions: {
        //removeOnComplete: true,
        removeOnFail: false,
      },
    });
    const onHouseRetail = BullModule.registerQueue({
      name: 'on-house-retail',
      defaultJobOptions: {
        //removeOnComplete: true,
        removeOnFail: false,
      },
    });

    return {
      module: QueuesModule,
      imports: [
        BullModule.forRoot({
          connection: {
            host: 'localhost',
            port: 6379,
            password: undefined,
          },
        }),
        extensionMessage,
        heroUpdate,
        houseUpdate,
        CronEveryHour,
        webhookQuicknode,
        onHeroRetail,
        onHouseRetail,
      ],
      providers: [
        ...extensionMessage.providers,
        ...heroUpdate.providers,
        ...houseUpdate.providers,
        ...CronEveryHour.providers,
        ...webhookQuicknode.providers,
        ...onHeroRetail.providers,
        ...onHouseRetail.providers,
      ],
      exports: [
        ...extensionMessage.exports,
        ...heroUpdate.exports,
        ...houseUpdate.exports,
        ...CronEveryHour.exports,
        ...webhookQuicknode.exports,
        ...onHeroRetail.exports,
        ...onHouseRetail.exports,
      ],
    };
  }

  constructor(
    @InjectQueue('hero-update') private readonly heroUpdate: HeroUpdateQueue,
    @InjectQueue('extension-message') private readonly extensionMessage: Queue,
    @InjectQueue('house-update') private readonly houseUpdate: Queue,
    @InjectQueue('cron-every-hour') private readonly cronEveryHour: Queue,
    @InjectQueue('webhook-quicknode') private readonly webhookQuicknode: Queue,
    @InjectQueue('on-hero-retail') private readonly onHeroRetail: Queue,
    @InjectQueue('on-house-retail') private readonly onHouseRetail: Queue,
  ) {}

  configure(consumer: MiddlewareConsumer) {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/queues');

    createBullBoard({
      queues: [
        new BullMQAdapter(this.heroUpdate),
        new BullMQAdapter(this.extensionMessage),
        new BullMQAdapter(this.houseUpdate),
        new BullMQAdapter(this.cronEveryHour),
        new BullMQAdapter(this.webhookQuicknode),
        new BullMQAdapter(this.onHeroRetail),
        new BullMQAdapter(this.onHouseRetail),
      ],
      serverAdapter,
    });

    consumer.apply(serverAdapter.getRouter()).forRoutes('/queues');
  }
}
