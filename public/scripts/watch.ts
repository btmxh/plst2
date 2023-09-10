const scheme = location.protocol === "https:" ? "wss:" : "ws:";
const wssUri = `${scheme}//${location.host}/watch`;
console.log(`Attempting to connect to WebSocket endpoint at ${wssUri}`);
const socket = new WebSocket(wssUri);
socket.onopen = () => {
  console.log("WebSocket connection established");
};

socket.onerror = (ev) => {
  console.error("WebSocket error: ", ev);
};

window.onbeforeunload = function () {
  socket.close();
};

const addUrlBtn = document.getElementById("add-url-btn");
addUrlBtn.addEventListener("click", async (e) => {
  const data = new FormData(addUrlBtn.parentElement as HTMLFormElement);
  const response = await fetch("/api/playlist/add", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(Object.fromEntries(data)),
  });

  if (response.status !== 200) {
    alert(`error trying to add to playlist, go to console for details`);
    console.error("Unable to add to playlist");
    console.error("Status code: ", response.status);
    console.error("JSON response", await response.json());
  }
});

const onPlayerStateChange = (event) => {
  if (event.data === YT.PlayerState.ENDED) {
    socket.send("next");
  }
};

let ytPlayer: YT.Player;
let resolveFn = (p: YT.Player) => {};

(window as any).onYouTubeIframeAPIReady = () => {
  const tempPlayer = new YT.Player(player, {
    width: "100%",
    height: "100%",
    playerVars: {
      playsinline: 1,
      autoplay: 1,
      enablejsapi: 1,
      modestbranding: 0,
      cc_lang_pref: "en",
    },
    events: {
      onReady: () => {
        ytPlayer = tempPlayer;
        resolveFn(ytPlayer);
      },
      onStateChange: onPlayerStateChange,
    },
  });
}

const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
const player = document.createElement("div");
const playerWrapper = document.getElementById("yt-player-wrapper");
playerWrapper.replaceChildren(player);

const getYoutubePlayer = (): Promise<YT.Player> => {
  if (ytPlayer) {
    return Promise.resolve(ytPlayer);
  }

  return new Promise((resolve, reject) => {
    resolveFn = resolve;
    if(ytPlayer) {
      resolve(ytPlayer);
    }
  });
};

const fetchPlayer = async () => {
  const current = await fetch("/api/playlist/current").then((r) => r.json());
  const playerWrapper = document.getElementById("player-wrapper");
  for (const child of playerWrapper.children) {
    child.classList.remove("active");
  }
  if (current?.type === "yt") {
    const ytPlayerWrapper = document.getElementById("yt-player-wrapper");
    ytPlayerWrapper.style.aspectRatio = current.aspectRatio;
    ytPlayerWrapper.classList.add("active");
    const yt = await getYoutubePlayer();
    yt.loadVideoById(current.ytId);
    yt.playVideo();
    console.log("yt player loaded");
    return;
  }

  if(ytPlayer) {
    ytPlayer.stopVideo();
  }
};

const getPlaylistIds = (): number[] | undefined => {
  const form = document.getElementById("playlist-form");
  if (!form) {
    return undefined;
  }
  const formData = new FormData(form as HTMLFormElement);
  const ids = [];
  for (const name of formData.keys()) {
    if (name.startsWith("playlist-media-")) {
      const id = name.substring("playlist-media-".length);
      const idInt = parseInt(id);
      if (!isNaN(idInt)) {
        ids.push(idInt);
      }
    }
  }

  return ids;
};

const fetchPlaylist = async () => {
  const playlistIds = getPlaylistIds();
  document.getElementById("playlist-form").innerHTML = await fetch(
    "/ssr/playlist.html?ids=" + playlistIds.join(",")
  )
    .then((r) => r.text())
    .catch((err) => {
      console.log("Unable to load playlist", err);
      return `<h1>error loading playlist</h1>`;
    });
  console.log("playlist loaded");
};

await Promise.all([fetchPlayer(), fetchPlaylist()]);

socket.onmessage = (e) => {
  const data = e.data;
  if (data === "refresh-playlist") {
    fetchPlaylist();
  } else if (data === "media-changed") {
    fetchPlaylist();
    fetchPlayer();
  }
};

[...document.getElementsByClassName("playlist-refresh-btn")].forEach((b) =>
  b.addEventListener("click", async (e) => {
    await fetchPlaylist();
  })
);

[...document.getElementsByClassName("playlist-prev-btn")].forEach((b) =>
  b.addEventListener("click", async (e) => {
    fetch("/api/playlist/prev", {
      method: "POST",
    });
  })
);

[...document.getElementsByClassName("playlist-next-btn")].forEach((b) =>
  b.addEventListener("click", async (e) => {
    fetch("/api/playlist/next", {
      method: "POST",
    });
  })
);

for (const dir of ["down", "up"]) {
  [...document.getElementsByClassName(`playlist-${dir}-btn`)].forEach((b) =>
    b.addEventListener("click", async (e) => {
      const ids = getPlaylistIds();
      fetch("/api/playlist/edit", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: `move-${dir}`,
          ids,
        }),
      }).catch((err) => console.error("Unable to move playlist entries:", err));
    })
  );
}
[...document.getElementsByClassName("playlist-remove-btn")].forEach((b) =>
  b.addEventListener("click", async (e) => {
    const ids = getPlaylistIds();
    fetch("/api/playlist/edit", {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ids,
      }),
    });
  })
);

for (const input of document.getElementsByClassName("text-input-drop")) {
  const elem = input as HTMLInputElement;
  elem.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    e.preventDefault();

    const uri = dt.getData("URL");
    if (uri.length !== 0) {
      elem.value = uri;
      return;
    }

    const text = dt.getData("text/plain");
    if (text.length !== 0) {
      elem.value = text;
      return;
    }
  });
}
