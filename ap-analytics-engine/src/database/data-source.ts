import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config(); // Load .env

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'dbsenha',
  database: process.env.DB_NAME || 'bombstats',
  synchronize: false,
  logging: true,
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  subscribers: [],
});
