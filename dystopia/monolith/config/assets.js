import * as assets from "hanami-assets";

await assets.run({
  esbuildOptionsFn: (args, esbuildOptions) => {
    return esbuildOptions;
  },
});
