import { fileURLToPath } from "url";
import { MediaCommonData, ServerMediaData } from "../context/media";
import path from "path";
import { spawn } from "node:child_process";

async function getMediaLength(path: string): Promise<number | undefined> {
  const process = spawn("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    path,
  ]);

  const chunks = [];
  for await (const chunk of process.stdout) {
    chunks.push(Buffer.from(chunk));
  }

  const length = parseFloat(Buffer.concat(chunks).toString("utf-8"));
  if (isNaN(length)) {
    return undefined;
  }

  return length;
}

export async function urlToServerMedia(
  url: string
): Promise<(ServerMediaData & MediaCommonData) | undefined> {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== "file:") {
      return undefined;
    }

    const filePath = fileURLToPath(urlObj);
    const basename = path.basename(filePath);

    return {
      type: "server",
      path: filePath,
      displayHtml: `<span class="server-prefix">(server) </span><span class="server-path">${basename}</span>`,
      length: (await getMediaLength(filePath)) ?? 99 * 60 + 99,
      link: url,
    };
  } catch {
    return undefined;
  }
}
