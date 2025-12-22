import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  user: "stream_app",
  host: "127.0.0.1",
  database: "stream_platform",
  password: "streampass",
  port: 5432,
});

async function runWorker() {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      UPDATE videos
      SET status = 'processing',
      claimed_at = NOW()

      WHERE id = (
        SELECT id
        FROM videos
        WHERE status = 'uploaded'
        ORDER BY created_at
        LIMIT 1
      )
      RETURNING id;
    `);

    if (result.rowCount === 0) {
      console.log("no work available");
    } else {
      console.log("claimed video", result.rows[0].id);
    }
  } catch (err) {
    console.error("worker error", err);
  } finally {
    client.release();
  }
}

async function detectAbandonedJobs() {
  const client = await pool.connect();

  try {
    const result = await client.query(`
            UPDATE videos
          SET
            status = 'uploaded',
            claimed_at = NULL
          WHERE id IN (
            SELECT id
            FROM videos
            WHERE
              status = 'processing'
              AND claimed_at IS NOT NULL
              AND NOW() - claimed_at > INTERVAL '1 minute'
            LIMIT 1
          )
          RETURNING id;

    `);

    // console.log(result);

    if (result.rowCount === 0) {
      console.log("no abandoned jobs detected");
    } else {
      console.log("abandoned jobs detected and is freed", result.rows[0].id);
    }
  } catch (err) {
    console.error("worker error", err);
  } finally {
    client.release();
  }
}

async function main() {
  await detectAbandonedJobs();
  await runWorker();
  await pool.end();
}

main().catch(console.error);
