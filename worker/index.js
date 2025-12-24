import pkg from "pg";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const { Pool } = pkg;

const pool = new Pool({
  user: "stream_app",
  host: "127.0.0.1",
  database: "stream_platform",
  password: "streampass",
  port: 5432,
});

function runFFMPEG(input_path, id) {
  return new Promise((resolve, reject) => {
    const outputDir = `videos/hls/${id}`;
    fs.mkdirSync(outputDir, { recursive: true });

    const ffmpeg = spawn("ffmpeg", [
      "-i",
      input_path,
      "-vf",
      "scale=1280:720",
      "-c:v",
      "h264",
      "-c:a",
      "aac",
      "-hls_time",
      "6",
      "-hls_playlist_type",
      "vod",
      `${outputDir}/index.m3u8`,
    ]);

    ffmpeg.stderr.on("data", (d) => console.error(d.toString()));

    ffmpeg.on("close", (code) => {
      resolve(code); // 👈 THIS is the key
    });

    ffmpeg.on("error", reject);
  });
}

async function getInputPath(id) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT input_path
        FROM videos
        WHERE id = $1 ;`,
      [id]
    );

    console.log("input path:- ", result.rows[0].input_path);
    return result.rows[0].input_path;
  } catch (err) {
    console.log("some error", err);
  } finally {
    client.release();
  }
}

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
      return result.rows[0].id;
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
      // console.log(result);
    }
  } catch (err) {
    console.error("worker error", err);
  } finally {
    client.release();
  }
}

// async function main() {
//   const client = await pool.connect();

//   try {
//     await detectAbandonedJobs();

//     const jobID = await runWorker();
//     if (!jobID) return;

//     const inputPath = await getInputPath(jobID);

//     const exitCode = await runFFMPEG(inputPath, jobID);

//     if (exitCode === 0) {
//       await client.query(
//         `UPDATE videos
//          SET status = 'ready',
//              hls_path = $2,
//              claimed_at = NULL
//          WHERE id = $1`,
//         [jobID, `videos/hls/${jobID}`]
//       );
//       console.log("video marked READY");
//     } else {
//       const result = await client.query(
//         `
//     UPDATE videos
//     SET
//       retry_count = retry_count + 1,
//       status = CASE
//         WHEN retry_count + 1 >= 3 THEN 'failed'
//         ELSE 'uploaded'
//       END,
//       claimed_at = NULL,
//       last_error = $2
//     WHERE id = $1
//     RETURNING status, retry_count;
//     `,
//         [jobID, `ffmpeg exited with code ${exitCode}`]
//       );

//       console.log(
//         `FFmpeg failed → status=${result.rows[0].status}, retries=${result.rows[0].retry_count}`
//       );
//     }
//   } catch (err) {
//     console.error("worker crashed", err);
//   } finally {
//     client.release();
//     await pool.end();
//   }
// }

async function finalizeJob(jobID, exitCode) {
  const client = await pool.connect();
  try {
    if (exitCode === 0) {
      await client.query(
        `UPDATE videos
         SET status = 'ready',
             hls_path = $2,
             claimed_at = NULL
         WHERE id = $1`,
        [jobID, `videos/hls/${jobID}`]
      );
      console.log("video marked READY");
    } else {
      const result = await client.query(
        `
    UPDATE videos
    SET
      retry_count = retry_count + 1,
      status = CASE
        WHEN retry_count + 1 >= 3 THEN 'failed'
        ELSE 'uploaded'
      END,
      claimed_at = NULL,
      last_error = $2
    WHERE id = $1
    RETURNING status, retry_count;
    `,
        [jobID, `ffmpeg exited with code ${exitCode}`]
      );

      console.log(
        `FFmpeg failed → status=${result.rows[0].status}, retries=${result.rows[0].retry_count}`
      );
    }
  } catch (err) {
    console.log("Some error occoured", err);
  } finally {
    client.release();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  while (true) {
    try {
      await detectAbandonedJobs();
      const jobID = await runWorker();

      if (!jobID) {
        await sleep(5000);
        continue;
      }

      const inputPath = await getInputPath(jobID);
      const exitCode = await runFFMPEG(inputPath, jobID);

      await finalizeJob(jobID, exitCode);
    } catch (err) {
      console.error("worker crashed", err);
      await sleep(5000);
    }
  }
}

main().catch(console.error);
