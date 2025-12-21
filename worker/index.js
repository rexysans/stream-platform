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
      SET status = 'processing'
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
    await pool.end();
  }
}

runWorker();
