import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/scripts/seed.ts'],
  format: ['cjs'],
  dts: false,
  clean: true,
  sourcemap: true,
  noExternal: ['@kodevon/shared', '@kodevon/db'],
})
