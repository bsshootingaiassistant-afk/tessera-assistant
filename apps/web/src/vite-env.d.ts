/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  readonly VITE_GITHUB_REPO?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  cordova?: {
    plugins?: {
      fileOpener2?: {
        open: (options: {
          filePath: string;
          contentType?: string;
          openWithDefault?: boolean;
        }) => Promise<unknown>;
      };
    };
  };
}
