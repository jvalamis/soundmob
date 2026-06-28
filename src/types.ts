export type PlaybackState = {
  videoId: string | null;
  title: string;
  thumbnail: string;
  playing: boolean;
  positionSec: number;
  updatedAt: number;
};

export type QueueItem = {
  videoId: string;
  title: string;
  thumbnail: string;
};

export type RoomSnapshot = {
  code: string;
  hostName: string;
  playback: PlaybackState;
  queue: QueueItem[];
  listeners: number;
};

export type ActiveRoom = {
  code: string;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  picture: string;
  activeRoom?: ActiveRoom;
};

export type LiveStatus =
  | { live: false }
  | {
      live: true;
      code: string;
      joinUrl: string;
      hostName: string;
      listeners: number;
      playback: Pick<
        PlaybackState,
        "videoId" | "title" | "thumbnail" | "playing" | "positionSec"
      >;
    };

export type WsClientMessage =
  | { type: "playback"; playback: PlaybackState }
  | { type: "queue"; queue: QueueItem[] }
  | { type: "chat"; text: string; name: string }
  | { type: "ping" };

export type WsServerMessage =
  | { type: "state"; room: RoomSnapshot }
  | { type: "chat"; text: string; name: string; at: number }
  | { type: "error"; message: string }
  | { type: "pong" };
