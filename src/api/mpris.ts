import path from "path";
import { Context } from "../context/context";
// @ts-ignore
import Player from "mpris-service";
import { JSDOM } from "jsdom";
import * as ws from "ws";
import { exec } from "child_process";

export interface MprisClient {
  update(context: Context): void;
  play(context: Context, client: ws.WebSocket | undefined): void;
  pause(context: Context, client: ws.WebSocket | undefined): void;
}

export class NoopMprisClient {
  constructor() { }

  update() { }
  play() { }
  pause() { }
}

export class DefaultMprisClient {
  mprisPlayer: Player;
  playing = true;

  constructor(context: Context) {
    this.mprisPlayer = Player({
      name: "plst",
      identity: "Media player server",
      supportedUriSchemes: ["file", "http", "https"],
      supportedInterfaces: ["player"],
    });
    this.mprisPlayer.on("next", () =>
      context.updatePlaylistIndex((i) => i + 1)
    );
    this.mprisPlayer.on("previous", () =>
      context.updatePlaylistIndex((i) => i - 1)
    );
    this.mprisPlayer.on("play", () => {
      context.announce("play");
    });
    this.mprisPlayer.on("pause", () => {
      context.announce("pause");
    });
    this.mprisPlayer.on("playpause", () => {
      if (this.playing) {
        context.announce("pause");
      } else {
        context.announce("play");
      }

      this.playing = !this.playing;
      this.update(context);
    });

    this.update(context);
  }

  update(context: Context) {
    const currentPlaying = context.playlist.getCurrentMedia();
    if (currentPlaying === null || currentPlaying === undefined) {
      this.mprisPlayer.metadata = {};
      this.mprisPlayer.playbackStatus = "Stopped";
      return;
    }

    const xesam = (() => {
      if (currentPlaying.type === "yt") {
        const html = new JSDOM(currentPlaying.displayHtml).window.document;
        const title =
          html.querySelector(".yt-title")?.textContent ?? "Untitled";
        const artist =
          html.querySelector(".yt-author")?.textContent ?? "Unknown Artist";

        return {
          "xesam:title": title,
          "xesam:artist": [artist],
        };
      } else if (currentPlaying.type === "server") {
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
        "mpris:length":
          Math.round(currentPlaying.length) ?? (99 * 60 + 99) * 1000,
        "xesam:url": currentPlaying.link,
        ...xesam,
      };
    this.mprisPlayer.playbackStatus = this.playing ? "Playing" : "Paused";
    this.updateI3StatusBar();
  }

  updateI3StatusBar() {
    if (process.env.NO_I3STATUS !== undefined) {
      return;
    }

    console.log("refreshing i3status");
    exec("killall -USR1 i3status", (error, stdout, stderr) => {
      if (error) {
        console.log(`error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
      }
      if(stdout) {
        console.log(`stdout: ${stdout}`);
      }
    });
  }

  play(context: Context, client: ws.WebSocket | undefined) {
    this.playing = true;
    this.update(context);
    context.announce("play", client);
  }

  pause(context: Context, client: ws.WebSocket | undefined) {
    this.playing = false;
    this.update(context);
    context.announce("pause", client);
  }
}

export function createMprisClient(context: Context): MprisClient {
  if (process.env["NO_MPRIS"] !== undefined) {
    return new NoopMprisClient();
  }

  try {
    return new DefaultMprisClient(context);
  } catch (e) {
    console.error("Unable to create MPRIS client");
    return new NoopMprisClient();
  }
}
