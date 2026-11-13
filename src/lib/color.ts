function parseHex(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16) / 255,
    green: Number.parseInt(normalized.slice(2, 4), 16) / 255,
    blue: Number.parseInt(normalized.slice(4, 6), 16) / 255,
  };
}

export function hexToHslValue(hex: string) {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const { red, green, blue } = rgb;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return `0 0% ${Math.round(lightness * 100)}%`;

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max === red) hue = 60 * (((green - blue) / delta) % 6);
  if (max === green) hue = 60 * ((blue - red) / delta + 2);
  if (max === blue) hue = 60 * ((red - green) / delta + 4);
  if (hue < 0) hue += 360;

  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

export function hexContrastForeground(hex: string) {
  const rgb = parseHex(hex);
  if (!rgb) return "0 0% 100%";
  const luminance = (0.2126 * rgb.red) + (0.7152 * rgb.green) + (0.0722 * rgb.blue);
  return luminance > 0.58 ? "260 31% 13%" : "0 0% 100%";
}
