import { existsSync } from 'fs';

import * as dotenv from 'dotenv';
import { resolve } from 'path';

const envFileName = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';

let envPath = resolve(process.cwd(), envFileName);

if (!existsSync(envPath)) {
  envPath = resolve(process.cwd(), '.env');
}

dotenv.config({ path: envPath });
