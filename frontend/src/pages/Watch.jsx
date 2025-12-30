import VideoPlayer from "../components/VideoPlayer";
import { useRef, useState, useEffect } from "react";
import videojs from "video.js";

function Watch() {
  const playerRef = useRef(null);
  const videoId = "1db3cf79-5cd2-42ef-870b-706b7c94b059";
  const videoLink = `http://localhost:5000/hls/${videoId}/master.m3u8`;

  function getAnonymousUserId() {
    let id = localStorage.getItem("anon_user_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("anon_user_id", id);
    }
    return id;
  }

  const [videoData, setVideoData] = useState({
    title: "Loading...",
    description: "Loading...",
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVideoData = async () => {
      try {
        const res = await fetch(`http://localhost:5000/videos/${videoId}`);
        const data = await res.json();
        setVideoData({
          title: data.title,
          description: data.description || "No description available",
        });
      } catch (err) {
        setError("Failed to load video metadata");
      }
    };

    fetchVideoData();
  }, [videoId]);

  const videoPlayerOptions = {
    controls: true,
    responsive: true,
    fluid: true,
    sources: [
      {
        src: videoLink,
        type: "application/x-mpegURL",
      },
    ],
  };

  const handlePlayerReady = async (player) => {
    playerRef.current = player;
    const userId = getAnonymousUserId();

    // 🔑 Restore progress AFTER metadata loads
    player.one("loadedmetadata", async () => {
      const res = await fetch(
        `http://localhost:5000/progress/${videoId}/${userId}`
      );
      const data = await res.json();

      if (data.lastTime > 0) {
        player.currentTime(data.lastTime);
      }
    });

    // Save progress every 5s
    const interval = setInterval(() => {
      if (!player.paused()) {
        fetch("http://localhost:5000/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            videoId,
            lastTime: player.currentTime(),
          }),
        });
      }
    }, 5000);

    player.on("pause", () => {
      fetch("http://localhost:5000/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          videoId,
          lastTime: player.currentTime(),
        }),
      });
    });

    player.on("dispose", () => clearInterval(interval));
  };

  return (
    <>
      <div style={{ padding: "20px" }}>
        {error ? (
          <p style={{ color: "red" }}>{error}</p>
        ) : (
          <>
            <h1>{videoData.title}</h1>
            <p style={{ color: "#666" }}>{videoData.description}</p>
          </>
        )}
      </div>

      <VideoPlayer options={videoPlayerOptions} onReady={handlePlayerReady} />
    </>
  );
}

export default Watch;
