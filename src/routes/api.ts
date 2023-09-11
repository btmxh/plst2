import { Router } from "express";
import { playlistAPIRouter } from "./playlist.js";
import { Context } from "../context/context.js";

export function apiRouter(context: Context): Router {
  const router = Router();

  router.use("/playlist", playlistAPIRouter(context));

  // for debugging purposes
  router.post("/exit", (req, res) => {
    res.status(200).send();
    setTimeout(() => process.exit(0), 1000);
  });

  router.get("/exit", (req, res) => {
    res.status(200).send();
    setTimeout(() => process.exit(0), 1000);
  });

  return router;
}
