import pg from "pg";

const {Pool} = pg;
type Pool = pg.Pool;

let pool: Pool | null = null;
let lastLogMsg: string;

export default function getPgPool(databaseUrl: string): Pool {
    if (!pool) {
        pool = new Pool({
            connectionString: databaseUrl,
            max: 10,
        });
        pool.on('error', e => {
            log(`Postgres pool error: ${e?.message ?? e}`);
        });
        pool.on('connect', () => {
            log("Postgres connected!");
        });
    }
    return pool;
}

function log(msg: string) {
    if (msg !== lastLogMsg) {
        console.info(msg);
        lastLogMsg = msg;
    }
}
