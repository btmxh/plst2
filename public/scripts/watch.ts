import { ReconnectableSocket } from "./watch-socket";
import { getCachedYoutubePlayer, stopAllPlayers } from "./yt-embed-player";

let socket: ReconnectableSocket | undefined = undefined;

const fetchPlayer = async () => {
  const current = await fetch("/api/playlist/current").then((r) => r.json());
  const playerWrapper = document.getElementById("player-wrapper")!;
  for (const child of playerWrapper.children) {
    child.classList.remove("active");
  }
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

  await stopAllPlayers();
};

const fetchPlaylist = async () => {
  document.body.dispatchEvent(new Event('refresh-playlist'));
};

socket = new ReconnectableSocket((msg) => {
  if (msg === "refresh-playlist") {
    fetchPlaylist();
  } else if (msg === "media-changed") {
    fetchPlaylist();
    fetchPlayer();
  }
});

fetchPlayer();
