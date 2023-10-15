import { Playlist, PlaylistAddPosition } from "./playlist.js";
import { Youtube } from "../api/youtube.js";
import { workspaceDir } from "../utils.js";
import path from "path";
import { readFile } from "fs/promises";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import * as ws from "ws";
import { IncomingMessage } from "http";
import { Duplex } from "stream";
import { urlToServerMedia } from "../api/server_media.js";
import { MprisClient, createMprisClient } from "../api/mpris.js";

export class Context {
  playlist: Playlist;
  youtube: Youtube;
  websocketServer: ws.WebSocketServer;
  mprisClient: MprisClient;

  constructor(json: any = undefined) {
    this.playlist = new Playlist(json?.playlist);
    this.youtube = new Youtube(json?.youtube);
    this.websocketServer = new ws.WebSocketServer({
      noServer: true,
      path: "/watch",
    });
    this.mprisClient = createMprisClient(this);
  }

  toJSON() {
    return {
      playlist: this.playlist,
      youtube: this.youtube,
    };
  }

  async addToPlaylist(url: string, position: PlaylistAddPosition) {
    const media = await urlToServerMedia(url);
    if (media !== undefined) {
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

    this.mprisClient.update(this);
    return true;
  }

  announce(msg: string): void {
    this.websocketServer.clients.forEach((client) => client.send(msg));
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
