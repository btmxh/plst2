import express from "express";
import dotenv from "dotenv";
import path from "path";

import * as url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

dotenv.config();

const app = express();

const port = parseInt(process.env.PORT ?? "36736");

app.use(
  express.static(path.join(__dirname, "dist"), {
    index: false,
    extensions: ["html"],
  })
);

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

app.listen(port, () => {
  console.log(`plst2 server running on http://localhost:${port}`);
  console.log("Access the API via the /api/ endpoint");
  console.log(`Webapp frontend is available at http://localhost:${port}/index`);
});
