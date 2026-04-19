// Ambient types for `postcss-prefix-selector`, which ships no declarations.
// Signature derived from the package README (v2.x).
declare module "postcss-prefix-selector" {
  import type { Plugin } from "postcss";

  export interface PrefixSelectorOptions {
    prefix: string;
    exclude?: Array<string | RegExp>;
    includeFiles?: Array<string | RegExp>;
    excludeFiles?: Array<string | RegExp>;
    ignoreFiles?: Array<string | RegExp>;
    transform?: (
      prefix: string,
      selector: string,
      prefixedSelector: string,
      filePath?: string,
      rule?: unknown,
    ) => string;
  }

  const prefixer: (options: PrefixSelectorOptions) => Plugin;
  export default prefixer;
}
