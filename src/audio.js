/**
 * audio.js
 * Two synthesized tracks, distance crossfade at 50 units.
 */

import * as THREE from 'three';

const RIM_FULL_DISTANCE = 50;

export function createAudioSystem(listener) {
  const ctx = listener.context;
  const master = ctx.createGain();
  master.gain.value = 0.0;
  master.connect(listener.getInput());

  const rim = buildRimTrack(ctx);
  rim.output.connect(master);
  const core = buildCoreTrack(ctx);
  core.output.connect(master);

  let started = false;

  async function start() {
    if (started) return;
    started = true;
    if (ctx.state === 'suspended') {
      await Promise.race([
        ctx.resume().catch(() => {}),
        new Promise((r) => setTimeout(r, 600)),
      ]);
    }
    try { rim.start(); } catch (_) {}
    try { core.start(); } catch (_) {}
    const now = ctx.currentTime || 0;
    try { master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(0, now); master.gain.linearRampToValueAtTime(1.0, now + 0.6); } catch (_) {}
  }

  function update(position) {
    if (!started) return;
    const dist = Math.hypot(position.x, position.z);
    const rimAmount = THREE.MathUtils.clamp(dist / RIM_FULL_DISTANCE, 0, 1);
    const t = rimAmount * rimAmount * (3 - 2 * rimAmount);
    const now = ctx.currentTime || 0;
    try { rim.gain.gain.setTargetAtTime(0.55 * t + 0.08, now, 0.12); core.gain.gain.setTargetAtTime(0.42 * (1 - t) + 0.04, now, 0.12); } catch (_) {}
  }

  function stop() {
    if (!started) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.linearRampToValueAtTime(0, now + 0.4);
    setTimeout(() => { rim.stop(); core.stop(); }, 500);
    started = false;
  }

  return { start, update, stop };
}

function buildRimTrack(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179; b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852; b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522; b5 = -0.7616 * b5 - white * 0.016898;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    data[i] = pink * 0.11;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer; src.loop = true;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(2048);
  for (let i = 0; i < curve.length; i++) { const x = (i * 2) / curve.length - 1; curve[i] = ((1 + 60) * x) / (1 + 60 * Math.abs(x)); }
  shaper.curve = curve; shaper.oversample = '4x';
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass'; lowpass.frequency.value = 900; lowpass.Q.value = 0.7;
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass'; highpass.frequency.value = 80;
  const gain = ctx.createGain(); gain.gain.value = 0.0;
  src.connect(highpass); highpass.connect(shaper); shaper.connect(lowpass); lowpass.connect(gain);
  return { output: gain, gain, start() { try { src.start(); } catch (_) {} }, stop() { try { src.stop(); } catch (_) {} } };
}

function buildCoreTrack(ctx) {
  const output = ctx.createGain(); output.gain.value = 1.0;
  const mix = ctx.createGain(); mix.gain.value = 0.0; mix.connect(output);
  const shelf = ctx.createBiquadFilter();
  shelf.type = 'highshelf'; shelf.frequency.value = 3000; shelf.gain.value = 0.0; shelf.connect(mix);
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass'; lowpass.frequency.value = 4200; lowpass.Q.value = 0.4; lowpass.connect(shelf);
  const freqs = [110.0, 164.81, 220.0];
  const oscs = freqs.map((f) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 8;
    const g = ctx.createGain(); g.gain.value = 0.22; o.connect(g); g.connect(lowpass);
    return { o, g };
  });
  const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.08;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 4.0; lfo.connect(lfoGain); lfoGain.connect(shelf.gain);
  const gain = ctx.createGain(); gain.gain.value = 0.0; output.connect(gain);
  return { output: gain, gain, start() { try { oscs.forEach(({ o }) => o.start()); lfo.start(); } catch (_) {} }, stop() { try { oscs.forEach(({ o }) => o.stop()); lfo.stop(); } catch (_) {} } };
}