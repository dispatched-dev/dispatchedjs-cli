import typescript from "@rollup/plugin-typescript";
import shebang from "rollup-plugin-shebang-bin";

export default {
  input: "src/index.js",
  output: [
    {
      file: "dist/index.js",
      format: "cjs",
    },
    {
      file: "dist/index.esm.js",
      format: "es",
    },
  ],
  plugins: [typescript(), shebang()],
};
