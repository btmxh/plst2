import { ReconnectableSocket } from "./watch-socket";
import {
  getCachedYoutubePlayer,
  stopAllPlayers as stopAllYTPlayers,
} from "./yt-embed-player";

let socket: ReconnectableSocket | undefined = undefined;

const serverVideoPlayer = document.getElementById(
  "server-player",
) as HTMLVideoElement;
serverVideoPlayer.addEventListener("ended", (e) => socket?.send("next"));

const stopAllPlayers = async () => {
  await stopAllYTPlayers();
  serverVideoPlayer.pause();
};

const fetchPlayer = async () => {
  const current = await fetch("/api/playlist/current").then((r) => r.json());
  const playerWrapper = document.getElementById("player-wrapper")!;
  for (const child of playerWrapper.children) {
    child.classList.remove("active");
  }

  await stopAllPlayers();

  if (current?.type === "yt") {
    const ytPlayer = await getCachedYoutubePlayer("yt-player", (e) => {
      if (e.data === YT.PlayerState.ENDED) {
        socket?.send("next");
      }
    });
    const ytPlayerWrapper = document.getElementById("yt-player-wrapper")!;
    ytPlayerWrapper.style.aspectRatio = current.aspectRatio;
    ytPlayerWrapper.classList.add("active");
    ytPlayer.loadVideoById(current.ytId);
    ytPlayer.playVideo();
    return;
  }

  if (current?.type === "server") {
    document.getElementById("server-player-wrapper")?.classList.add("active");
    serverVideoPlayer.currentTime = 0;
    serverVideoPlayer.load();
    try {
      await serverVideoPlayer.play();
    } catch (e) {
      console.error("autoplay not permitted", e);
    }
    return;
  }
};

const fetchPlaylist = async () => {
  document.body.dispatchEvent(new Event("refresh-playlist"));
};

socket = new ReconnectableSocket((msg) => {
  if (msg === "refresh-playlist") {
    fetchPlaylist();
  } else if (msg === "media-changed") {
    fetchPlaylist();
    fetchPlayer();
  }
});

[...document.querySelectorAll(".scroll-to-current-playing")].forEach((e) => {
  e.addEventListener("click", () => {
    const currentPlaying = document.querySelector("#playlist-current-playing");
    currentPlaying?.scrollIntoView({
      behavior: "smooth",
    });
  });
});

fetchPlayer();
