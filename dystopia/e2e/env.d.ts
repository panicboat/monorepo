// Declares only what the suite reads so the package needs no @types/node.
declare const process: { readonly env: Readonly<Record<string, string | undefined>> };
