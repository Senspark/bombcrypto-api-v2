import { join } from 'path';

import '../setup-env';
export default {
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false,
  entities: [join(__dirname, 'models/*.{js,ts}')],
  migrations: [join(__dirname, 'migrations/*.{js,ts}')],
  subscribers: [join(__dirname, 'subscribers/*.{js,ts}')],
  extra: {
    decimalNumbers: true,
    isolationLevel: 'READ COMMITTED',

    // connectionLimit: 30,
  },
};
