import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true })
  );

  app.enableCors();
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  // Listen on 0.0.0.0 for Docker container mapping
  await app.listen(port, '0.0.0.0');
  console.log(`BombCrypto Data Engine (Fastify) is running on: ${await app.getUrl()}`);
}
bootstrap();
