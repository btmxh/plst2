import { Duration } from "luxon";

export type Media = (YoutubeVideo | ServerMedia) & MediaCommon;

export type MediaCommon = {
  displayHtml: string;
  length: Duration;
};

export type YoutubeVideo = {
  type: "yt";
  ytId: string;
  aspectRatio: string;
};

export type ServerMedia = {
  type: "server";
  relativeUrl: string;
};

export type Indexed<M> = M & { id: number };
