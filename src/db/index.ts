import { Kysely } from 'kysely';
import { Pool } from 'pg';
import { PostgresDialect } from 'kysely';
import { Database } from './schema';

// 创建数据库连接
export function createDB() {
    return new Kysely<Database>({
        dialect: new PostgresDialect({
            pool: new Pool({
                connectionString: DATABASE_URL,
            }),
        }),
    });
} 