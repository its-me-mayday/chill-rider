type Sound = HTMLAudioElement | null;

function createSound(src: string, volume = 0.6): Sound {
  if (typeof Audio === "undefined") {
    return null;
  }

  const audio = new Audio(src);
  audio.volume = volume;
  return audio;
}

const coinSound: Sound = createSound("/chill-rider/sfx/coin.wav", 0.5);
const shopSound: Sound = createSound("/chill-rider/sfx/shop.wav", 0.6);
const deliverySound: Sound = createSound(
  "/chill-rider/sfx/delivery.wav",
  0.7
);

function play(sound: Sound) {
  if (!sound) return;
  try {
    sound.currentTime = 0;
    void sound.play();
  } catch {
    // ignore play errors (autoplay policies, etc.)
  }
}

export const sfx = {
  playCoin() {
    play(coinSound);
  },
  playShop() {
    play(shopSound);
  },
  playDelivery() {
    play(deliverySound);
  },
};
