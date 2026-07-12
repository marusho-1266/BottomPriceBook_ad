// Windows でカレントディレクトリのドライブレターが小文字(n:\...)だと
// Vitest がモジュールを二重ロードして "failed to find the current suite" になるため、
// 大文字に正規化した cwd で vitest を起動する。
import { spawnSync } from 'node:child_process';

const cwd = process.cwd().replace(/^([a-z]):/, (_, d) => `${d.toUpperCase()}:`);
const result = spawnSync('npx', ['vitest', ...process.argv.slice(2)], {
  cwd,
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
