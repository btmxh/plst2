import { Router } from "express";
import { Context } from "../context/context.js";
import { startsWithSubstring } from "../utils.js";
import { PlaylistAddPosition } from "../context/playlist.js";

export function playlistAPIRouter(context: Context): Router {
  const router = Router();
  router.get("/current", (req, res) => {
    const currentMedia = context.playlist.getCurrentMedia() ?? null;
    res.status(200).json(currentMedia);
  });

  return router;
}

export function playlistRouter(context: Context): Router {
  const router = Router();

  router.patch("/next", (req, res) => {
    const updated = context.updatePlaylistIndex((i) => i + 1);
    res.status(updated ? 200 : 304).send();
  });

  router.patch("/prev", (req, res) => {
    const updated = context.updatePlaylistIndex((i) => i - 1);
    res.status(updated ? 200 : 304).send();
  });

  for (const direction of ["up", "down"]) {
    const offset = direction === "up" ? 1 : -1;
    router.patch(`/move/${direction}`, (req, res) => {
      const ids = new Set<string>();
      for (const [key, value] of Object.entries(req.body)) {
        const id = startsWithSubstring(key, "playlist-media-");
        if (id === undefined || value !== "on") {
          continue;
        }

        ids.add(id);
      }

      const updated = context.movePlaylistMedias(ids, offset);
      res.status(updated ? 200 : 304).send();
    });
  }

  router.post("/add", async (req, res) => {
    let url = req.body.url;
    if (typeof url !== "string") {
      res.status(400).send();
      return;
    }

    let position = req.body.position as PlaylistAddPosition;
    if (
      typeof position !== "string" ||
      !Object.values(PlaylistAddPosition).includes(position)
    ) {
      res.status(400).send("invalid playlist add position");
      return;
    }

    try {
      await context.addToPlaylist(url, position);
      res.status(200).send("<p>let's go chat</p>");
    } catch (e) {
      console.error(e);
      res.status(422).send(`<span style="color: red">unable to add '${url}' to playlist: ${e}</span>`);
    }
  });

  router.delete("/delete", (req, res) => {
    const ids = new Set<string>();
    for (const [key, value] of Object.entries(req.body)) {
      const id = startsWithSubstring(key, "playlist-media-");
      if (id === undefined || value !== "on") {
        continue;
      }

      ids.add(id);
    }

    const updated = context.removePlaylistMedias(ids);
    res.status(updated ? 200 : 304).send();
  });

  return router;
}
