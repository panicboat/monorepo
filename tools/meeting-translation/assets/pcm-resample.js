export function resamplePcm16(input, inputSampleRate, outputSampleRate) {
  if (inputSampleRate === outputSampleRate) {
    return input.slice();
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i * ratio;
    const lowerIndex = Math.floor(sourceIndex);
    const upperIndex = Math.min(lowerIndex + 1, input.length - 1);
    const weight = sourceIndex - lowerIndex;
    const interpolated = input[lowerIndex] * (1 - weight) + input[upperIndex] * weight;
    output[i] = Math.max(-32768, Math.min(32767, Math.round(interpolated)));
  }

  return output;
}
