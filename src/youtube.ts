import { Duration } from "luxon";
import { MediaCommon, YoutubeVideo } from "./media.js";
import { spawn } from "node:child_process";
import { Context } from "./context.js";

export type YoutubeMedia = YoutubeVideo & MediaCommon;
const cache = new Map<string, YoutubeMedia>();

async function fetchYoutubeMedia(id: string): Promise<YoutubeMedia> {
  const ytdl = process.env.YOUTUBE_DL ?? "yt-dlp";
  const ytdlProcess = spawn(ytdl, [
    `https://www.youtube.com/watch?v=${id}`,
    "-O",
    "%(.{title,channel,duration,width,height})#j",
  ]);
  return new Promise((resolve, reject) => {
    let result = "";
    ytdlProcess.stdout.on("data", (data) => (result += data));
    ytdlProcess.on("close", (code) => {
      if (code !== 0) {
        reject(`${ytdl} exited with exit code ${code}`);
      }

      try {
        console.debug(result);
        const data = JSON.parse(result);
        resolve({
          type: "yt",
          displayHtml: createYoutubeDisplayHTML(data),
          length: Duration.fromObject({
            seconds: data.duration,
          }),
          aspectRatio: `${data.width}/${data.height}`,
          ytId: id,
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

export async function fetchMedia(
  context: Context,
  id: string
): Promise<YoutubeMedia> {
  return (
    context.youtubeCache[id] ??
    (await (async () => {
      const media = await fetchYoutubeMedia(id);
      context.youtubeCache[id] = media;
      return media;
    })())
  );
}
function createYoutubeDisplayHTML(data: any): string {
  return `<span class="yt-title">${data.title}</span><span class="yt-separator"> - </span><span class="yt-author">${data.channel}</span>`;
}
