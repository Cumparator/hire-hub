import pg from 'pg';

const { Pool } = pg;

let pool;

export async function initDb() {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // DATABASE_URL=postgres://user:pass@localhost:5432/hirehub
  });

  // Проверяем соединение при старте
  const client = await pool.connect();
  client.release();
}

/**
 * Выполнить SQL-запрос.
 * @param {string} text  SQL с $1, $2 ... плейсхолдерами
 * @param {any[]}  params Значения параметров
 */
export async function query(text, params) {
  return pool.query(text, params);
}

export { pool };
