import express from "express";
import dotenv from "dotenv";
import path from "path";
import { WebSocket, WebSocketServer } from "ws";
import * as url from "url";
import {
  Context,
  addToPlaylist,
  currentPlaylistIndex,
  currentPlaylistMedia,
  newContext,
} from "./src/context.js";
import { readFile } from "fs/promises";
import { existsSync, mkdirSync, writeFileSync } from "fs";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

dotenv.config();

const app = express();

app.use(express.json());

const wsWatchServer = new WebSocketServer({
  noServer: true,
  path: "/watch",
});

const context =
  (await (async () => {
    try {
      const contextJson = await readFile(".cache/context.json", {
        encoding: "utf-8",
      });
      return JSON.parse(contextJson) as Context;
    } catch (e) {
      console.error(
        "Unable to load previous context (ignore this if this is the first run):",
        e
      );
      return undefined;
    }
  })()) ?? newContext();

const exitEvents = [
  `exit`,
  `SIGINT`,
  `SIGUSR1`,
  `SIGUSR2`,
  `uncaughtException`,
  `SIGTERM`,
];
for (const exitEvent of exitEvents) {
  process.on(exitEvent, async (e) => {
    let code = 0;
    if (exitEvent === "uncaughtException") {
      console.error(e);
      code = 1;
    }

    if(!existsSync(".cache")) {
      mkdirSync(".cache");
    }
    writeFileSync(".cache/context.json", JSON.stringify(context));
    process.exit(code);
  });
}

function autonext(): boolean {
  if (context.playlist.currentMediaId === null) {
    return true;
  }

  for (const client of wsWatchServer.clients) {
    if (!nextedClients.has(client)) {
      return false;
    }
  }

  return wsWatchServer.clients.size > 0;
}

const port = parseInt(process.env.PORT);
const host = process.env.HOST ?? "localhost";

app.use(
  express.static(path.join(__dirname, "dist"), {
    index: false,
    extensions: ["html"],
  })
);

app.get("/", (req, res) => {
  res.redirect("/index");
});

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.get("/ssr/playlist.html", (req, res) => {
  const idsString = req.query.ids ?? "";
  if (typeof idsString !== "string") {
    res.status(400).send("invalid `ids` query");
    return;
  }

  const ids = new Set<number>();
  if (idsString.trim().length > 0) {
    for (const idString of idsString.split(",")) {
      const s = idString.trim();
      const id = parseInt(idString.trim());
      if (!isNaN(id)) {
        ids.add(id);
      } else {
        res.status(400).send(`invalid id '${idString}'`);
      }
    }
  }

  res.render(
    "playlist",
    {
      ...context,
      mediaChecked: (id: number) => ids.has(id),
    },
    (err, html) => {
      if (err) {
        console.error("Error rendering playlist page: ", err);
        res.render("playlist-error");
      } else {
        res.status(200).type("html").send(html);
      }
    }
  );
});

app.get("/ssr/player.html", (req, res) => {
  const playlist = context.playlist;
  const media = currentPlaylistMedia(playlist);
  if (media === undefined) {
    res.status(200).send();
    return;
  }

  if (media.type === "yt") {
    res.status(200).render("youtube-player", {
      aspectRatio: media.aspectRatio,
      id: media.ytId,
    });
    return;
  }

  throw new Error("could not find player for media");
});

function playlistUpdated() {
  wsWatchServer.clients.forEach((client) => {
    client.send("refresh-playlist");
  });

  if (autonext()) {
    updateMediaIndex(1);
  }
}

const nextedClients = new Set<WebSocket>();

app.post("/api/playlist/add", async (req, res) => {
  try {
    await addToPlaylist(context, req.body);
    res.status(200).send();
  } catch (e) {
    console.error("Unable to add to playlist", e);
    res.status(422).json(e?.toString());
  }

  playlistUpdated();
});

function mediaUpdated() {
  nextedClients.clear();
  wsWatchServer.clients.forEach((client) => {
    client.send("media-changed");
  });
}

async function updateMediaIndex(delta: number) {
  const p = context.playlist;
  const newIndex = currentPlaylistIndex(p) + delta;
  if (newIndex >= 0 && newIndex < p.medias.length) {
    p.currentMediaId = p.medias[newIndex].id;
    mediaUpdated();
    return true;
  }

  return false;
}

app.post("/api/playlist/next", async (req, res) => {
  res.status(updateMediaIndex(1) ? 200 : 304).send();
});
app.post("/api/playlist/prev", async (req, res) => {
  res.status(updateMediaIndex(-1) ? 200 : 304).send();
});
app.post("/api/playlist/edit", async (req, res) => {
  const params = req.body;
  let offset = 0,
    swap = false;
  if (params.type === "move-down") {
    offset = -1;
  } else if (params.type === "move-up") {
    offset = 1;
  } else {
    res.status(404).json("invalid edit type");
    return;
  }
  const ids = new Set(params.ids as number[]);
  const medias = context.playlist.medias;
  for (let i = 0; i < medias.length; ++i) {
    const index = offset > 0 ? medias.length - 1 - i : i;
    if (ids.has(medias[index].id)) {
      const swapIndex = index + offset;
      if (swapIndex < 0 || swapIndex >= medias.length) {
        continue;
      }

      if (ids.has(medias[swapIndex].id)) {
        continue;
      }

      const temp = medias[index];
      medias[index] = medias[swapIndex];
      medias[swapIndex] = temp;
      swap = true;
    }
  }

  if (swap) {
    playlistUpdated();
  }

  res.status(swap ? 200 : 304).send();
});
app.delete("/api/playlist/edit", async (req, res) => {
  const ids = new Set<number>(req.body.ids ?? []);
  const newList = context.playlist.medias.filter((media) => !ids.has(media.id));
  const changed = newList.length !== context.playlist.medias.length;
  context.playlist.medias = newList;
  if (ids.has(context.playlist.currentMediaId)) {
    context.playlist.currentMediaId = null;
    mediaUpdated();
  } else {
    playlistUpdated();
  }
  res.status(changed ? 200 : 304).send();
});
app.get("/api/playlist/current", async (req, res) => {
  console.debug("wtf");
  res.status(200).json(currentPlaylistMedia(context.playlist) ?? null);
});

let server = undefined;
app.get("/api/exit", (req, res) => {
  res.status(200).send();
  wsWatchServer.close();
  server?.close();
  process.exit(0);
});

app.use(async (req, res, next) => {
  res.status(404);

  if (req.accepts("html")) {
    res.status(404).sendFile(path.join(__dirname, "dist/404.html"));
    return;
  }

  if (req.accepts("json")) {
    res.json({ error: "404 Not Found" });
    return;
  }

  res.type("txt").send("not found");
});

server = app.listen(port, host, () => {
  console.log(`plst2 server running on http://${host}:${port}`);
  console.log("Access the API via the /api/ endpoint");
  if (process.env.NODE_ENV === "production") {
    console.log(
      `Webapp frontend is available at http://${host}:${port}/index`
    );
  } else {
    console.log(`Webapp frontend is hosted by webpack-dev-server`);
  }
});

server.on("upgrade", (request, socket, head) => {
  wsWatchServer.handleUpgrade(request, socket, head, (ws) => {
    wsWatchServer.emit("connection", ws, request);

    ws.onmessage = (e) => {
      if (e.data === "next") {
        nextedClients.add(ws);
        if (autonext()) {
          updateMediaIndex(1);
        }
      }
    };
  });
});
