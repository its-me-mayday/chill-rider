export type SfxTheme = "chill" | "hawkins";

type Sound = HTMLAudioElement | null;

function createSound(src: string, volume = 0.6): Sound {
  if (typeof Audio === "undefined") {
    return null;
  }

  const audio = new Audio(src);
  audio.volume = volume;
  return audio;
}

const chillCoin: Sound = createSound("/chill-rider/sfx/coin.wav", 0.5);
const chillShop: Sound = createSound("/chill-rider/sfx/shop.wav", 0.6);
const chillDelivery: Sound = createSound(
  "/chill-rider/sfx/delivery.wav",
  0.7
);

const hawkinsCoin: Sound = createSound(
  "/chill-rider/sfx/hawkins-coin.wav",
  0.5
);
const hawkinsShop: Sound = createSound(
  "/chill-rider/sfx/hawkins-shop.wav",
  0.6
);
const hawkinsDelivery: Sound = createSound(
  "/chill-rider/sfx/hawkins-delivery.wav",
  0.7
);

function play(sound: Sound) {
  if (!sound) return;
  try {
    sound.currentTime = 0;
    void sound.play();
  } catch {
    // ignoriamo eventuali errori (autoplay policies, ecc.)
  }
}

export const sfx = {
  playCoin(theme: SfxTheme) {
    if (theme === "hawkins") {
      play(hawkinsCoin);
    } else {
      play(chillCoin);
    }
  },
  playShop(theme: SfxTheme) {
    if (theme === "hawkins") {
      play(hawkinsShop);
    } else {
      play(chillShop);
    }
  },
  playDelivery(theme: SfxTheme) {
    if (theme === "hawkins") {
      play(hawkinsDelivery);
    } else {
      play(chillDelivery);
    }
  },
};
