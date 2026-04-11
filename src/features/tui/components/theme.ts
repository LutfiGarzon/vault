function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function colorize(hex: string, text: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
}

export const Flexoki = {
  tx: (text: string) => colorize('#CECDC3', text),
  tx2: (text: string) => colorize('#878580', text),
  red: (text: string) => colorize('#D14D41', text),
  green: (text: string) => colorize('#879A39', text),
  yellow: (text: string) => colorize('#D0A215', text),
  blue: (text: string) => colorize('#4385BE', text),
  purple: (text: string) => colorize('#CE5D97', text),
};

export const log = {
  success: (msg: string) => console.log(`${Flexoki.green('✔')} ${Flexoki.tx(msg)}`),
  error: (msg: string) => console.error(`${Flexoki.red('✘')} ${Flexoki.tx(msg)}`),
  info: (msg: string) => console.log(`${Flexoki.blue('›')} ${Flexoki.tx(msg)}`),
  warn: (msg: string) => console.log(`${Flexoki.yellow('!')} ${Flexoki.tx(msg)}`),
  vault: (msg: string) => console.log(`${Flexoki.purple('◈')} ${Flexoki.tx(msg)}`),
};
