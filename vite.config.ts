import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // GitHub Pages는 https://kim-taehan.github.io/woodada/ 하위에 서빙되므로 빌드 시 base 필요.
  base: command === 'build' ? '/woodada/' : '/',
  server: { port: 5173, host: true },
  build: { target: 'es2022' },
}));
