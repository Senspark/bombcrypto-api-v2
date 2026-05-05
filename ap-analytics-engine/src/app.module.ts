import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
// import { BlockchainModule } from './blockchain/blockchain.module';
// import { WorkersModule } from './workers/workers.module';
import { ApiModule } from './api/api.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'dbsenha',
      database: process.env.DB_NAME || 'bombstats',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // Set to true to create new tables (Stake, Claim)
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    BullModule.registerQueue({
      name: 'ingestion-bsc',
    }),
    BullModule.registerQueue({
      name: 'ingestion-polygon',
    }),
    // BlockchainModule,
    // WorkersModule,
    ApiModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
