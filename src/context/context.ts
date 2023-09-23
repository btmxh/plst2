import { Media, MediaData } from "./media.js";
import { Playlist, PlaylistAddPosition } from "./playlist.js";
import { Youtube } from "../api/youtube.js";
import { workspaceDir } from "../utils.js";
import path from "path";
import { readFile } from "fs/promises";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import * as ws from "ws";
import { IncomingMessage } from "http";
import { Duplex } from "stream";
// @ts-ignore
import Player from "mpris-service";
import * as jsdom from "jsdom";
import { fileURLToPath } from "url";
import { urlToServerMedia } from "../api/server_media.js";

export class Context {
  playlist: Playlist;
  youtube: Youtube;
  websocketServer: ws.WebSocketServer;
  mprisPlayer: Player;

  constructor(json: any = undefined) {
    this.playlist = new Playlist(json?.playlist);
    this.youtube = new Youtube(json?.youtube);
    this.websocketServer = new ws.WebSocketServer({
      noServer: true,
      path: "/watch",
    });

    this.mprisPlayer = Player({
      name: "plst",
      identity: "Media player server",
      supportedUriSchemes: ["file", "http", "https"],
      supportedInterfaces: ["player"],
    });
    this.mprisPlayer.on("next", () => this.updatePlaylistIndex((i) => i + 1));
    this.mprisPlayer.on("previous", () =>
      this.updatePlaylistIndex((i) => i - 1)
    );
    this.updateMpris();
  }

  toJSON() {
    return {
      ...this,
      websocketServer: undefined,
      mprisPlayer: undefined,
    };
  }

  updateMpris() {
    const currentPlaying = this.playlist.getCurrentMedia();
    if (currentPlaying === null || currentPlaying === undefined) {
      this.mprisPlayer.metadata = {};
      this.mprisPlayer.playbackStatus = "Stopped";
      return;
    }

    const xesam = (() => {
      if (currentPlaying.type === "yt") {
        const html = new jsdom.JSDOM(currentPlaying.displayHtml).window
          .document;
        const title =
          html.querySelector(".yt-title")?.textContent ?? "Untitled";
        const artist =
          html.querySelector(".yt-author")?.textContent ?? "Unknown Artist";

        return {
          "xesam:title": title,
          "xesam:artist": [artist],
        };
      } else if(currentPlaying.type === "server") {
        return {
          "xesam:title": path.basename(currentPlaying.path),
          "xesam:artist": ["Unknown"],
        };
      }

      return {};
    })();

    if (currentPlaying.length)
      this.mprisPlayer.metadata = {
        "mpris:trackid": this.mprisPlayer.objectPath(
          `track/${currentPlaying.id}`
        ),
        "mpris:length": Math.round(currentPlaying.length) ?? (99 * 60 + 99) * 1000,
        ...xesam,
      };
    this.mprisPlayer.playbackStatus = "Playing";
  }

  async addToPlaylist(url: string, position: PlaylistAddPosition) {
    const media = await urlToServerMedia(url);
    if(media !== undefined) {
      this.playlist.add(media, position);
      this.#triggerPlaylistRefresh();
      return;
    }

    const ytId = this.youtube.urlToVideoId(url);
    if (ytId !== undefined) {
      const video = await this.youtube.fetchMedia(ytId);
      this.playlist.add(video, position);
      this.#triggerPlaylistRefresh();
      return;
    }

    throw new Error("invalid url");
  }

  registerExitCallbacks() {
    const exitEvents = [
      `exit`,
      `SIGINT`,
      `SIGUSR1`,
      `SIGUSR2`,
      `uncaughtException`,
      `SIGTERM`,
    ];

    for (const exitEvent of exitEvents) {
      process.on(exitEvent, (e) => {
        try {
          let code = 0;
          if (exitEvent === "uncaughtException") {
            console.error(e);
            code = 1;
          }

          if (!existsSync(".cache")) {
            mkdirSync(".cache");
          }
          writeFileSync(".cache/context.json", JSON.stringify(this));
          process.exit(code);
        } catch (e) {
          console.error("error while running context exit hook", e);
        }
      });
    }
  }

  #triggerPlaylistRefresh() {
    this.websocketServer.clients.forEach((client) => {
      client.send("refresh-playlist");
    });

    if (this.playlist.canNext(this.websocketServer.clients)) {
      this.updatePlaylistIndex((i) => i + 1);
    }
  }

  updatePlaylistIndex(transformer: (index: number) => number): boolean {
    let updated = false;
    this.playlist.updateIndex((index) => {
      const newIndex = transformer(index);
      updated = index !== newIndex;
      return newIndex;
    });

    if (!updated) {
      return false;
    }

    this.websocketServer.clients.forEach((client) =>
      client.send("media-changed")
    );

    this.updateMpris();
    return true;
  }

  movePlaylistMedias(ids: Set<string>, offset: number): boolean {
    if (!this.playlist.moveMedias(ids, offset)) {
      return false;
    }

    this.#triggerPlaylistRefresh();
    return true;
  }

  removePlaylistMedias(ids: Set<string>): boolean {
    const currentId = this.playlist.getCurrentMedia()?.id;
    if (currentId !== undefined && currentId !== null && ids.has(currentId)) {
      this.updatePlaylistIndex(() => -1);
    }

    if (this.playlist.removeMedias(ids)) {
      this.#triggerPlaylistRefresh();
      return true;
    }

    return false;
  }

  gotoMedia(id: string): boolean {
    const index = this.playlist.playlist.indexOf(id);
    if (index < 0) {
      return false;
    }

    return this.updatePlaylistIndex(() => index);
  }

  handleWebSocketUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer
  ) {
    this.websocketServer.handleUpgrade(request, socket, head, (ws) => {
      this.websocketServer.emit("connection", ws, request);

      ws.onmessage = (e) => {
        if (e.data === "next") {
          this.playlist.clientNext(ws);
          if (this.playlist.canNext(this.websocketServer.clients)) {
            this.updatePlaylistIndex((i) => i + 1);
          }
        }
      };
    });
  }
}

async function loadContextCache(): Promise<any> {
  const cacheFile = path.join(workspaceDir, ".cache/context.json");
  try {
    const content = await readFile(cacheFile, { encoding: "utf-8" });
    return JSON.parse(content);
  } catch (e) {
    console.error(
      "Unable to load previous context cache (ignore this if this is the first run):",
      e
    );
    return undefined;
  }
}

export async function createContext() {
  const jsonCache = await loadContextCache();
  return new Context(jsonCache);
}
