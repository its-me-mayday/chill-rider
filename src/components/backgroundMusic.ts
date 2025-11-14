import type { SfxTheme } from "./soundEffects";

type Track = HTMLAudioElement | null;

function createTrack(src: string, volume = 0.35): Track {
  if (typeof Audio === "undefined") {
    return null;
  }

  const audio = new Audio(src);
  audio.loop = true;
  audio.volume = volume;
  return audio;
}

const chillTrack: Track = createTrack(
  "/chill-rider/music/background-music.mp3",
  0.35
);
const hawkinsTrack: Track = createTrack(
  "/chill-rider/music/hawkins-background-music.mp3",
  0.35
);

function play(track: Track) {
  if (!track) return;
  try {
    void track.play();
  } catch {
  }
}

function stop(track: Track) {
  if (!track) return;
  track.pause();
  track.currentTime = 0;
}

export const bgm = {
  play(theme: SfxTheme) {
    if (theme === "hawkins") {
      stop(chillTrack);
      play(hawkinsTrack);
    } else {
      stop(hawkinsTrack);
      play(chillTrack);
    }
  },
  stop() {
    stop(chillTrack);
    stop(hawkinsTrack);
  },
  setVolume(volume: number) {
    const v = Math.min(1, Math.max(0, volume));
    if (chillTrack) chillTrack.volume = v;
    if (hawkinsTrack) hawkinsTrack.volume = v;
  },
};
