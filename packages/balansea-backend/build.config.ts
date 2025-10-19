import { defineBuildConfig } from 'unbuild';

// eslint-disable-next-line import/no-default-export
export default defineBuildConfig({
  clean: true,
  declaration: true,
  entries: ['src/bin/serverWorker', 'src/bin/jobWorker', 'src/bin/apiServer'],
  externals: [],
  outDir: 'dist',
  rollup: {
    emitCJS: false,
    inlineDependencies: true,
  },
});
