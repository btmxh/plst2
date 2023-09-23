import { Duration } from "luxon";

export type MediaData = (YoutubeVideoData | ServerMediaData) & MediaCommonData;

export type MediaCommonData = {
  link: string;
  displayHtml: string;
  // in secs
  length: number;
};

export type YoutubeVideoData = {
  type: "yt";
  ytId: string;
  aspectRatio: string;
};

export type ServerMediaData = {
  type: "server";
  path: string;
};

export type Media = MediaData & { id: string };
