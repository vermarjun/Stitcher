/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FEATURE_COMMUNITY?: string;
  [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
