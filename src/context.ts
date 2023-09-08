import { Indexed, Media } from "./media.js";
import { YoutubeMedia, mediaFromYoutubeVideoId } from "./youtube.js";

type Playlist = {
  medias: Indexed<Media>[];
  currentMediaId: number | null;
};

export type Context = {
  mediaIdCounter: number;
  playlist: Playlist;
  youtubeCache: Record<string, YoutubeMedia>;
};

export function newPlaylist(): Playlist {
  return {
    medias: [],
    currentMediaId: null,
  };
}

export function currentPlaylistIndex(playlist: Playlist): number {
  for (let i = 0; i < playlist.medias.length; ++i) {
    if (playlist.currentMediaId === playlist.medias[i].id) {
      return i;
    }
  }

  return -1;
}

export function currentPlaylistMedia(
  playlist: Playlist
): Indexed<Media> | undefined {
  const index = currentPlaylistIndex(playlist);
  return index >= 0 ? playlist.medias[index] : undefined;
}

export function newContext(): Context {
  return {
    playlist: newPlaylist(),
    mediaIdCounter: 0,
    youtubeCache: {},
  };
}

export async function addToPlaylist(
  context: Context,
  data: Record<string, string>
) {
  const url = data.url;
  const position = data.position;

  if (!url || !position) {
    throw new Error("Missing fields (either) `url` and/or `position`");
  }

  const add = (m: Indexed<Media>) => {
    const playlist = context.playlist;
    if (position === "add-to-end") {
      playlist.medias.push(m);
    } else if (position === "queue-next") {
      const currentIndex = currentPlaylistIndex(playlist);
      playlist.medias.splice(currentIndex + 1, 0, m);
    } else {
      throw new Error("Invalid add media location");
    }
  };

  const ytRegex =
    /^http(?:s?):\/\/(?:www\.)?youtu(?:be\.com\/watch\?v=|\.be\/)([\w\-\_]*)(&(amp;)?‌​[\w\?‌​=]*)?$/;
  const ytMatch = url.match(ytRegex);
  if (ytMatch) {
    const ytId = ytMatch[1];
    const yt = await mediaFromYoutubeVideoId(context, ytId);
    const id = ++context.mediaIdCounter;
    add({
      ...yt,
      id,
    });

    return;
  }

  throw new Error("invalid url");
}
