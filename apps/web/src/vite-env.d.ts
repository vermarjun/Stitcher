/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FEATURE_COMMUNITY?: string;
  readonly VITE_CLARITY_PROJECT_ID?: string;
  [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
