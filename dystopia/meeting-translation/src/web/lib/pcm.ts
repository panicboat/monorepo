export const toPcm16 = (samples: Float32Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);

  samples.forEach((sample, index) => {
    const normalized = Math.max(-1, Math.min(1, sample));
    const value = normalized < 0 ? normalized * 0x8000 : normalized * 0x7fff;
    view.setInt16(index * 2, value, true);
  });

  return buffer;
};
