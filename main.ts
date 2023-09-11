import express from "express";
import path from "path";
import { createContext } from "./src/context/context.js";
import { ssrRouter } from "./src/routes/ssr.js";
import { host, port, workspaceDir } from "./src/utils.js";
import { apiRouter } from "./src/routes/api.js";
import { playlistRouter } from "./src/routes/playlist.js";


const app = express();

app.use(express.urlencoded({ extended: false }));
app.set("views", path.join(workspaceDir, "views"));
app.set("view engine", "pug");

const context = await createContext();
context.registerExitCallbacks();

app.use(
  express.static(path.join(workspaceDir, "dist"), {
    index: false,
    extensions: ["html"],
  })
);

app.get("/htmx.js", (req, res) => {
  res
    .status(200)
    .sendFile(
      path.join(workspaceDir, "node_modules/htmx.org/dist/htmx.min.js")
    );
});

app.get("/", (req, res) => {
  res.redirect("/index");
});

app.use("/ssr", ssrRouter(context));
app.use("/api", apiRouter(context));
app.use("/playlist", playlistRouter(context));

app.use(async (req, res, next) => {
  res.status(404);

  if (req.accepts("html")) {
    res.status(404).sendFile(path.join(workspaceDir, "dist/404.html"));
    return;
  }

  if (req.accepts("json")) {
    res.json({ error: "404 Not Found" });
    return;
  }

  res.type("txt").send("not found");
});

const server = app.listen(port, host, () => {
  console.log(`plst2 server running on http://${host}:${port}`);
  console.log("Access the API via the /api/ endpoint");
  if (process.env.NODE_ENV === "production") {
    console.log(`Webapp frontend is available at http://${host}:${port}/index`);
  } else {
    console.log(`Webapp frontend is hosted by webpack-dev-server`);
  }
});

server.on("upgrade", (request, socket, head) => {
  context.handleWebSocketUpgrade(request, socket, head);
});
