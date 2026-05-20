/** Cores por altura Y para visualizar chão, paredes e teto */
export function colorsFromPositions(
  positions: Float32Array
): Float32Array {
  const n = positions.length / 3;
  const colors = new Float32Array(n * 3);

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const y = positions[i * 3 + 1];
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const range = Math.max(maxY - minY, 0.01);

  for (let i = 0; i < n; i++) {
    const y = positions[i * 3 + 1];
    const t = (y - minY) / range;

    if (t < 0.25) {
      colors[i * 3] = 0.2;
      colors[i * 3 + 1] = 0.75;
      colors[i * 3 + 2] = 0.45;
    } else if (t < 0.7) {
      colors[i * 3] = 0.35;
      colors[i * 3 + 1] = 0.65;
      colors[i * 3 + 2] = 0.95;
    } else {
      colors[i * 3] = 0.85;
      colors[i * 3 + 1] = 0.55;
      colors[i * 3 + 2] = 0.95;
    }
  }

  return colors;
}
