export function playLocationSound(context, volume, duration = 1) {
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
        samples[index] = Math.random() * 2 - 1;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const pan = context.createStereoPanner();
    const now = context.currentTime;
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.Q.value = .65;
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + duration * .45);
    filter.frequency.exponentialRampToValueAtTime(300, now + duration);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.38 * volume, now + duration * .35);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    pan.pan.setValueAtTime(.7, now);
    pan.pan.linearRampToValueAtTime(-.7, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(context.destination);
    source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
        pan.disconnect();
    };
    source.start(now);
    source.stop(now + duration);
}
