/**
 * The confetti noise, synthesised rather than played from a file.
 *
 * No asset and no dependency, which is the same call `BtMark` and `DvdLogo`
 * make about artwork: this site draws its own rather than shipping someone
 * else's. A party popper is two sounds and both are easy to build — a burst
 * of noise through a falling bandpass, which is the paper, and a few short
 * rising blips over the top, which is the celebration. Dropping an mp3 into
 * `public/` and playing it would work too; it would also be a binary nobody
 * can check and a licence to keep track of.
 *
 * ## It may not be audible, and that is not a bug here
 *
 * Browsers only let a page make noise after a *user activation*, and a
 * pointer moving over 36 chips is not one — only a click, a tap or a keypress
 * counts. So a visitor who has hovered their way through the egg without
 * clicking anything at all gets silence, and nothing can change that from
 * inside the page. The confetti and the unlock are unaffected, which is why
 * this is allowed to fail quietly instead of being the thing the egg waits
 * on. Most visitors will have clicked something by the time they get here.
 */
export function playPop() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    /*
     * Built at the moment of the unlock, not on mount. A context created up
     * front sits suspended for the whole visit on a page that may never fire
     * this, and Chrome logs a warning about it every time.
     */
    const ctx = new Ctor();
    void ctx.resume();

    const t0 = ctx.currentTime + 0.01;

    /*
     * The paper. White noise shaped by a square falloff so it starts as a
     * crack and ends as a rustle, then swept from bright to dull — a burst
     * that stays at one brightness reads as static.
     */
    const length = Math.floor(ctx.sampleRate * 0.35);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const decay = 1 - i / length;
      samples[i] = (Math.random() * 2 - 1) * decay * decay;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 0.8;
    band.frequency.setValueAtTime(2600, t0);
    band.frequency.exponentialRampToValueAtTime(700, t0 + 0.3);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.45, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);

    noise.connect(band).connect(noiseGain).connect(ctx.destination);
    noise.start(t0);

    /*
     * Three blips a major third apart, which is the shape of every "you did
     * it" sound ever written. Triangle rather than sine — a pure sine at this
     * length reads as a notification rather than as a toy.
     */
    [0, 0.09, 0.18].forEach((offset, step) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(520 * Math.pow(2, step / 3), t0 + offset);
      /* Ramped from near-silence, because an instant gain step clicks. */
      gain.gain.setValueAtTime(0.0001, t0 + offset);
      gain.gain.exponentialRampToValueAtTime(0.16, t0 + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + offset);
      osc.stop(t0 + offset + 0.25);
    });

    /* Or a context leaks per unlock, and browsers cap how many a page gets. */
    window.setTimeout(() => void ctx.close(), 900);
  } catch {
    /* No audio, or it's blocked. The confetti and the button still land. */
  }
}
