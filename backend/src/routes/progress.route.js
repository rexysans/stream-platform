import { Router } from "express";
import pool from "../db.js";

const router = Router();


router.post("/", async (req, res) => {
  const { userId, videoId, lastTime } = req.body;

  if (!userId || !videoId || lastTime == null) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    await pool.query(
      `
      INSERT INTO watch_progress (user_id, video_id, last_time_seconds)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, video_id)
      DO UPDATE
      SET last_time_seconds = EXCLUDED.last_time_seconds,
          updated_at = NOW()
      `,
      [userId, videoId, Math.floor(lastTime)]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save progress" });
  }
});








router.get("/:videoId/:userId", async (req, res) => {
  const { videoId, userId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT last_time_seconds
      FROM watch_progress
      WHERE user_id = $1 AND video_id = $2
      `,
      [userId, videoId]
    );

    res.json({
      lastTime: result.rows[0]?.last_time_seconds || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});






export default router;
