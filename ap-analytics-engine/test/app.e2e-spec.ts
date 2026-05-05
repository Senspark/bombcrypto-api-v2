import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/nfts (GET) - should return 400 for missing network', () => {
    return request(app.getHttpServer())
      .get('/nfts')
      .expect(400);
  });

  it('/nfts (GET) - should return 400 for invalid network', () => {
    return request(app.getHttpServer())
      .get('/nfts?network=invalid')
      .expect(400);
  });
});
