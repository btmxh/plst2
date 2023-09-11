import { Duration } from "luxon";

export type MediaData = (YoutubeVideoData | ServerMediaData) & MediaCommonData;

export type MediaCommonData = {
  displayHtml: string;
  length: Duration;
};

export type YoutubeVideoData = {
  type: "yt";
  ytId: string;
  aspectRatio: string;
};

export type ServerMediaData = {
  type: "server";
  relativeUrl: string;
};

export type Media = MediaData & { id: string };
