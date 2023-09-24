import { Router } from "express";
import { Context } from "../context/context.js";

export function ssrRouter(context: Context): Router {
  const router = Router();

  router.get("/playlist.html", (req, res) => {
    res.render(
      "playlist",
      {
        ...context,
        mediaChecked: (id: string) =>
          req.query[`playlist-media-${id}`] === "on",
        formatDuration: (secs: number) => {
          const hr = Math.floor(secs / 3600);
          const mn = Math.floor(secs / 60) % 60;
          const sc = Math.round(secs % 60);

          if (hr > 0) {
            return `${hr}:${mn.toString().padStart(2, "0")}:${sc
              .toString()
              .padStart(2, "0")}`;
          } else {
            return `${mn.toString().padStart(2, "0")}:${sc
              .toString()
              .padStart(2, "0")}`;
          }
        },
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
