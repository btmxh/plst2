import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const port = parseInt(process.env.PORT ?? "36736");

app.use(express.static("dist"));

app.listen(port, () => {
  console.log(`plst2 server running on http://localhost:${port}`);
  console.log("Access the API via the /api/ endpoint");
  console.log(
    `Webapp frontend is available at http://localhost:${port}/index.html`
  );
});
