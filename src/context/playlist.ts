import { MediaData, Media } from "./media.js";
import * as ws from "ws";

export enum PlaylistAddPosition {
  AddToEnd = "add-to-end",
  QueueNext = "queue-next",
}

class PlaylistIdGenerator {
  currentId = 0;

  constructor(existingIds: Iterable<string>, json: any) {
    this.currentId = json?.currentId ?? 0;
    for (const id of existingIds) {
      const numId = parseInt(id);
      if (!isNaN(numId)) {
        this.currentId = Math.max(this.currentId, numId);
      }
    }
  }

  generate(): string {
    return `${++this.currentId}`;
  }

  toJSON() {
    return {
      type: "counter",
      currentId: this.currentId,
    };
  }
}

export class Playlist {
  mediaMap = new Map<string, MediaData>();
  currentMediaIndex = -1;
  playlist = [] as string[];
  idGenerator: PlaylistIdGenerator;
  nextedClients = new Set<ws.WebSocket>();

  constructor(json: any = undefined) {
    this.mediaMap = new Map(
      Object.entries((json?.mediaMap ?? {}) as Record<string, MediaData>)
    );
    this.currentMediaIndex = json?.currentMediaIndex ?? -1;
    this.playlist = json?.playlist ?? [];
    this.idGenerator = new PlaylistIdGenerator(
      this.mediaMap.keys(),
      json?.idGenerator
    );
  }

  toJSON() {
    return {
      ...this,
      mediaMap: Object.fromEntries(this.mediaMap.entries()),
      nextedClients: undefined,
    };
  }

  add(mediaData: MediaData, position: PlaylistAddPosition) {
    const id = this.#registerMedia(mediaData);
    if (position === PlaylistAddPosition.AddToEnd) {
      this.playlist.push(id);
    } else if (position === PlaylistAddPosition.QueueNext) {
      const index = this.currentMediaIndex + 1;
      this.playlist.splice(index, 0, id);
    } else {
      this.mediaMap.delete(id);
      throw new Error("Invalid playlist add position");
    }
  }

  getCurrentMediaId() {
    return this.#getPlaylistMediaId(this.currentMediaIndex);
  }

  // undefined: this.currentMediaIndex is out of range
  // null: mediaMap.get(playlist[this.currentMediaIndex]) is undefined (invalid state)
  getCurrentMedia(): Media | null | undefined {
    const mediaId = this.getCurrentMediaId();
    if (mediaId === undefined) {
      return undefined;
    }

    return this.#getMediaFromId(mediaId) ?? null;
  }

  updateIndex(transformer: (index: number) => number): Media | undefined {
    let newIndex = transformer(this.currentMediaIndex);

    const newMediaId = this.#getPlaylistMediaId(newIndex);
    let media;
    if (newMediaId === undefined) {
      newIndex = -1;
    } else {
      media = this.#getMediaFromId(newMediaId);
    }

    this.currentMediaIndex = newIndex;
    this.nextedClients.clear();
    return media;
  }

  canNext(clients: Set<ws.WebSocket>): boolean {
    if (this.currentMediaIndex < 0 && this.playlist.length > 0) {
      return true;
    }

    const copy = new Set(clients);
    for (const nextedClient of this.nextedClients) {
      copy.delete(nextedClient);
    }

    return copy.size === 0 && clients.size > 0;
  }

  swapPlaylistIndex(i: number, j: number) {
    if (
      this.#getPlaylistMediaId(i) === undefined ||
      this.#getPlaylistMediaId(j) === undefined
    ) {
      return;
    }

    if (this.currentMediaIndex === i) {
      this.currentMediaIndex = j;
    } else if (this.currentMediaIndex === j) {
      this.currentMediaIndex = i;
    }

    const temp = this.playlist[i];
    this.playlist[i] = this.playlist[j];
    this.playlist[j] = temp;
  }

  moveMedias(ids: Set<string>, offset: number): boolean {
    let changed = false;
    for (let i = 0; i < this.playlist.length; i++) {
      const index = offset > 0 ? i : this.playlist.length - 1 - i;
      if (!ids.has(this.playlist[index])) {
        continue;
      }

      const swapIndex = index + offset;
      const swapId = this.#getPlaylistMediaId(swapIndex);
      if (swapId === undefined || ids.has(swapId)) {
        continue;
      }

      this.swapPlaylistIndex(index, swapIndex);
      changed = true;
      i++;
    }

    return changed;
  }

  removeMedias(ids: Set<string>): boolean {
    const currentId = this.getCurrentMedia()?.id;
    const newPlaylist = this.playlist.filter((id) => !ids.has(id));
    const changed = newPlaylist.length !== this.playlist.length;
    this.playlist = newPlaylist;
    this.currentMediaIndex = currentId !== undefined? this.playlist.indexOf(currentId) : -1;
    return changed;
  }

  clientNext(ws: ws.WebSocket) {
    this.nextedClients.add(ws);
  }

  getMedias(): Media[] {
    return this.playlist.flatMap((id) => {
      const media = this.#getMediaFromId(id);
      return media ? [media] : [];
    });
  }

  #getMediaFromId(id: string): Media | undefined {
    const media = this.mediaMap.get(id);
    if (media === undefined) {
      return undefined;
    }

    return {
      ...media,
      id,
    };
  }

  #getPlaylistMediaId(index: number): string | undefined {
    if (index >= 0 && index < this.playlist.length) {
      return this.playlist[index];
    } else {
      return undefined;
    }
  }

  #registerMedia(mediaData: MediaData): string {
    const id = this.idGenerator.generate();
    this.mediaMap.set(id, mediaData);
    return id;
  }
}
