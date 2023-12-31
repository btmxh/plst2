import { DateTime } from "luxon";
import { MediaCommonData, YoutubeVideoData } from "../context/media.js";
import { spawn } from "node:child_process";
import { AsyncCache } from "../context/async_cache.js";
import { RateLimiter } from "../../node_modules/limiter-es6-compat/dist/esm/RateLimiter.js";
import { startsWithSubstring } from "../utils.js";

export type YoutubeData = {
  title?: string;
  channel?: string;
  duration?: number;
  width?: number;
  height?: number;
};

export type YoutubeMedia = YoutubeVideoData & MediaCommonData;
export class Youtube {
  cache: AsyncCache<string, YoutubeMedia>;
  playlistCache: AsyncCache<string, string[]>;
  limiter = new RateLimiter({
    tokensPerInterval: 1,
    interval: "second",
  });

  constructor(json: any = undefined) {
    this.cache = new AsyncCache(
      (id) => this.#fetchVideoToMediaNoCache(id),
      json?.cache
    );

    this.playlistCache = new AsyncCache(
      (id) => this.#fetchPlaylistVideos(id),
      json?.playlistCache
    );
  }

  toJSON() {
    return {
      ...this,
      limiter: undefined,
    };
  }

  async fetchMedia(id: string): Promise<YoutubeMedia> {
    return await this.cache.fetch(id);
  }

  // return stdout
  #spawnYoutubeDL(args: string[] = []): Promise<string> {
    const ytdl = process.env.YOUTUBE_DL ?? "yt-dlp";
    const ytdlProcess = spawn(ytdl, args);
    return new Promise((resolve, reject) => {
      console.log("running youtube-dl: ", [ytdl, ...args]);
      let result = "";
      ytdlProcess.stdout.on("data", (data) => (result += data));
      ytdlProcess.on("close", (code) => {
        if (code !== 0) {
          reject(`${ytdl} exited with exit code ${code}`);
          return;
        }

        resolve(result);
      });
      setTimeout(() => reject("youtube-dl timeout"), 10000);
    });
  }

  async #fetchPlaylistVideos(id: string): Promise<string[]> {
    const ids = await this.#spawnYoutubeDL(["--flat-playlist", "--print", "id", `https://www.youtube.com/playlist?list=${id}`]);
    return ids.split("\n").map(id => id.trim()).filter(id => id.length > 0)
  }

  async #fetchVideoNoCache(id: string): Promise<YoutubeData> {
    const result = await this.#spawnYoutubeDL([
      `https://www.youtube.com/watch?v=${id}`,
      "-O",
      "%(.{title,channel,duration,width,height})#j",
    ]);
    return JSON.parse(result) as YoutubeData;
  }

  async #fetchVideoToMediaNoCache(id: string): Promise<YoutubeMedia> {
    let search;
    if ((search = startsWithSubstring(id, "search:")) !== undefined) {
      await this.limiter.removeTokens(1);
      id = await this.#performSearch(search);
    }

    await this.limiter.removeTokens(1);
    const video = await this.#fetchVideoNoCache(id);
    return {
      type: "yt",
      ytId: id,
      link: `https://youtu.be/${id}`,
      length: video.duration ?? (99*60+99),
      aspectRatio:
        video.width !== undefined && video.height !== undefined
          ? `${video.width}/${video.height}`
          : "16/9",
      displayHtml: this.#createYoutubeDisplayHTML(video, DateTime.now()),
    };
  }

  async #performSearch(query: string): Promise<string> {
    const stdout = await this.#spawnYoutubeDL([
      `ytsearch1:${query}`,
      "--get-id",
    ]);
    return stdout.trim();
  }

  #createYoutubeDisplayHTML(data: YoutubeData, addDate: DateTime): string {
    let html = "";
    if (data.title === undefined) {
      html += `<span class="yt-title yt-title-invalid">undefined</span>`;
    } else {
      html += `<span class="yt-title">${data.title}</span>`;
    }

    if (data.channel !== undefined) {
      html += `<span class="yt-separator"> - </span>
               <span class="yt-author">${data.channel}</span>`;
    }

    html += `<span class="media-add-date"> (added on ${addDate.toISODate()})</span>`;

    return html;
  }

  async urlToVideoIdList(url: string): Promise<YoutubeMedia[] | undefined> {
    try {
      if (!url.startsWith("http")) {
        url = `https://${url}`;
      }
      const urlObj = new URL(url);
      const host = urlObj.host;
      if (
        !host.includes("youtube") &&
        !host.includes("youtu.be") &&
        !host.includes("yt.be")
      ) {
        return undefined;
      }
      const queryId = urlObj.searchParams.get("v");
      const listId = urlObj.searchParams.get("list");
      const pathname = urlObj.pathname;
      const lastSlash = pathname.lastIndexOf("/");
      let lastPathComponent =
        lastSlash < 0
          ? undefined
          : decodeURIComponent(pathname.substring(lastSlash + 1));
      if(queryId !== null) {
        return [await this.cache.fetch(queryId)];
      }

      if(listId !== null) {
        const ids =  await this.playlistCache.fetch(listId);
        return Promise.all(ids.map(id => this.cache.fetch(id)));
      }

      if(lastPathComponent !== undefined) {
        return [await this.cache.fetch(lastPathComponent)];
      }
    } catch {}
    
    return undefined;
  }
}
