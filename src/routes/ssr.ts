import { Router } from "express";
import { Context } from "../context/context.js";

export function ssrRouter(context: Context): Router {
  const router = Router();

  router.get("/playlist.html", (req, res) => {
    res.render(
      "playlist",
      {
        ...context,
        mediaChecked: (id: string) => req.query[`playlist-media-${id}`] === "on",
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

  router.get("/player.html", (req, res) => {
    const media = context.playlist.getCurrentMedia() ?? undefined;
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

  return router;
}
