import path from "path";
import { Context } from "../context/context";
// @ts-ignore
import Player from "mpris-service";
import { JSDOM } from "jsdom";

export interface MprisClient {
  update(context: Context): void;
}

export class NoopMprisClient {
  constructor() {}

  update() {}
}

export class DefaultMprisClient {
  mprisPlayer: Player;

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
        ...xesam,
      };
    this.mprisPlayer.playbackStatus = "Playing";
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
