import { Models, Song } from "@saavn-labs/sdk";
import { downloadService } from "@/services/DownloadService";
import { AUDIO_QUALITY, STORAGE_KEYS } from "@/constants";
import { appStorage } from "@/stores/storage";
import { RepeatMode } from "@/types";
import { queueService } from "../QueueService";
import { StateUpdater, IPlayerService, PlayerState } from "./index.native";

export class PlayerService implements IPlayerService {
  private stateUpdater: StateUpdater | null = null;
  private isInitialized = false;
  private wantsToPlay = false;
  
  private audio!: HTMLAudioElement; 
  
  private queue: Models.Song[] = [];
  private currentIndex: number = -1;
  private repeatMode: RepeatMode = "off";

  constructor() {
    if (typeof window !== "undefined") {
      this.audio = new Audio();
      this.initialize();
    }
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized || !this.audio) return;

    this.setupEventListeners();
    this.setupMediaSession();
    this.isInitialized = true;
  }

  setStateUpdater(updater: StateUpdater): void {
    this.stateUpdater = updater;
  }

  private setupEventListeners(): void {
    this.audio.addEventListener("timeupdate", () => {
      this.notify({
        progress: this.audio.currentTime * 1000,
        duration: this.audio.duration * 1000 || 0,
      });
    });

    this.audio.addEventListener("playing", () => {
      this.notify({ status: "playing" });
    });

    this.audio.addEventListener("pause", () => {
      this.notify({ status: "paused" });
    });

    this.audio.addEventListener("waiting", () => {
      this.notify({ status: "loading" });
    });

    this.audio.addEventListener("ended", async () => {
      if (this.repeatMode === "one") {
        this.audio.currentTime = 0;
        await this.resume();
      } else {
        await this.next();
      }
    });

    this.audio.addEventListener("timeupdate", async () => {
      if (
        this.queue.length > 0 &&
        this.currentIndex >= this.queue.length - 2 &&
        this.queue[this.currentIndex]
      ) {
        await this.maybeExtendQueue(this.queue[this.currentIndex].id);
      }
    });
  }

  private setupMediaSession() {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => this.resume());
      navigator.mediaSession.setActionHandler("pause", () => this.pause());
      navigator.mediaSession.setActionHandler("previoustrack", () => this.previous());
      navigator.mediaSession.setActionHandler("nexttrack", () => this.next());
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime) this.seekTo(details.seekTime * 1000);
      });
    }
  }

  private updateMediaSessionMetadata(song: Models.Song) {
    if ("mediaSession" in navigator) {
      const artworkUrl = song.images?.[2]?.url || song.images?.[1]?.url || "";
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || "Unknown Title",
        artist: song.artists?.primary?.map((a) => a.name).join(", ") || "Unknown Artist",
        album: typeof song.album === "string" ? song.album : song.album?.title || "",
        artwork: artworkUrl ? [{ src: artworkUrl, sizes: "500x500", type: "image/jpeg" }] : [],
      });
    }
  }

  async play(song: Models.Song, providedQueue?: Models.Song[]): Promise<void> {
    try {
      this.wantsToPlay = true;

      this.notify({
        status: "loading",
        currentSong: song,
      });

      this.queue = await queueService.setQueue(song, providedQueue);
      this.currentIndex = this.queue.findIndex(s => s.id === song.id);
      if (this.currentIndex === -1) this.currentIndex = 0;

      await this.loadAndPlayCurrentIndex();

      this.notify({
        upcomingTracks: this.queue.slice(this.currentIndex + 1),
      });
    } catch (error) {
      console.error("[Web Player] Play failed:", error);
    }
  }

  private async loadAndPlayCurrentIndex(startPositionMs: number = 0): Promise<void> {
    const song = this.queue[this.currentIndex];
    if (!song) return;

    try {
      const streamUrl = await this.prepareTrackUrl(song);
      if (!streamUrl) throw new Error("Failed to get stream URL");

      this.audio.src = streamUrl;
      this.audio.currentTime = startPositionMs / 1000;
      this.updateMediaSessionMetadata(song);

      queueService.onTrackChanged(song.id);

      this.notify({
        currentSong: song,
        duration: song.duration ? song.duration * 1000 : 0,
        progress: startPositionMs,
      });

      if (this.wantsToPlay) {
        await this.audio.play();
      }
    } catch (error) {
      console.error("[Web Player] Load track failed:", error);
      // Auto-skip to next on failure
      this.next();
    }
  }

  async resume(): Promise<void> {
    this.wantsToPlay = true;
    try {
      await this.audio.play();
    } catch (err) {
      console.error("[Web Player] Resume failed (Autoplay policy?):", err);
    }
  }

  async restoreLastPlayedTrack(
    currentSong: Models.Song | null,
    progress: number,
  ): Promise<void> {
    if (!currentSong) return;

    try {
      this.wantsToPlay = false;
      this.queue = await queueService.setQueue(currentSong);
      this.currentIndex = 0;

      await this.loadAndPlayCurrentIndex(progress);

      this.notify({
        currentSong,
        upcomingTracks: this.queue.slice(1),
        status: "paused",
        progress,
        duration: currentSong.duration ? currentSong.duration * 1000 : 0,
      });
    } catch (error) {
      console.error("[Web Player] Restore track failed:", error);
    }
  }

  async pause(): Promise<void> {
    this.wantsToPlay = false;
    this.audio.pause();
  }

  async togglePlayPause(): Promise<void> {
    this.wantsToPlay = !this.wantsToPlay;
    if (this.wantsToPlay) {
      await this.resume();
    } else {
      await this.pause();
    }
  }

  async next(): Promise<void> {
    try {
      if (this.currentIndex >= this.queue.length - 1) {
        const qState = queueService.getState();

        if (qState.currentSong?.id) {
          const extended = await this.maybeExtendQueue(qState.currentSong.id);
          if (extended) {
            this.currentIndex++;
            await this.loadAndPlayCurrentIndex();
            return;
          }
        }

        if (this.repeatMode === "all" && this.queue.length > 0) {
          this.currentIndex = 0;
          await this.loadAndPlayCurrentIndex();
        }
        return;
      }

      this.currentIndex++;
      await this.loadAndPlayCurrentIndex();

      this.notify({
        upcomingTracks: this.queue.slice(this.currentIndex + 1),
      });
    } catch (error) {
      console.error("[Web Player] Next failed:", error);
    }
  }

  async previous(): Promise<void> {
    try {
      if (this.audio.currentTime > 3) {
        this.audio.currentTime = 0;
      } else if (this.currentIndex > 0) {
        this.currentIndex--;
        await this.loadAndPlayCurrentIndex();

        this.notify({
          upcomingTracks: this.queue.slice(this.currentIndex + 1),
        });
      }
    } catch (error) {
      console.error("[Web Player] Previous failed:", error);
    }
  }

  async seekTo(positionMs: number): Promise<void> {
    this.audio.currentTime = positionMs / 1000;
  }

  async setRepeatMode(mode: RepeatMode): Promise<void> {
    queueService.setRepeatMode(mode);
    this.repeatMode = mode;
    this.notify({ repeatMode: mode });
  }

  async stop(): Promise<void> {
    this.wantsToPlay = false;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();

    this.queue = [];
    this.currentIndex = -1;
    queueService.clear();

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = null;
    }

    this.notify({
      status: "paused",
      currentSong: null,
      upcomingTracks: [],
      progress: 0,
      duration: 0,
    });
  }

  async addToQueue(song: Models.Song): Promise<void> {
    try {
      this.queue.push(song);
      queueService.addToQueue(song);

      this.notify({
        upcomingTracks: this.queue.slice(this.currentIndex + 1),
      });
    } catch (error) {
      console.error("[Web Player] Add to queue failed:", error);
    }
  }

  async addNextInQueue(song: Models.Song): Promise<void> {
    try {
      this.queue.splice(this.currentIndex + 1, 0, song);
      queueService.addNextInQueue(song);

      this.notify({
        upcomingTracks: this.queue.slice(this.currentIndex + 1),
      });
    } catch (error) {
      console.error("[Web Player] Add next in queue failed:", error);
    }
  }

  private async prepareTrackUrl(song: Models.Song): Promise<string | null> {
    try {
      const downloadInfo = await downloadService.getDownloadInfo(song.id);

      if (downloadInfo && downloadInfo.filePath) {
        return downloadInfo.filePath;
      }

      const encrypted =
        song.media?.encryptedUrl ||
        (await Song.getById({ songIds: song.id })).songs[0]?.media?.encryptedUrl;

      if (!encrypted) throw new Error("No encrypted URL");

      const urls = await Song.experimental.fetchStreamUrls(encrypted, "edge", true);

      const quality = (await appStorage.getItem(STORAGE_KEYS.CONTENT_QUALITY)) || "medium";
      const idx =
        AUDIO_QUALITY[quality.toUpperCase() as keyof typeof AUDIO_QUALITY] ||
        AUDIO_QUALITY.MEDIUM;

      return urls[idx].url || null;
    } catch (error) {
      console.error("[Web Player] Failed to prepare track URL:", song.title, error);
      return null;
    }
  }

  private async maybeExtendQueue(seedSongId: string): Promise<boolean> {
    try {
      const newSongs = await queueService.extendQueue(seedSongId);

      if (newSongs.length === 0) return false;

      this.queue.push(...newSongs);

      this.notify({
        upcomingTracks: this.queue.slice(this.currentIndex + 1),
      });

      return true;
    } catch (error) {
      console.error("[Web Player] Extend queue failed:", error);
      return false;
    }
  }

  private notify(updates: Partial<PlayerState>): void {
    this.stateUpdater?.(updates);
  }
}

export const playerService = new PlayerService();