export type ToolName = 'python' | 'http' | 'plugin' | 'final';

export interface RuntimeAction {
  thought?: string;
  tool: ToolName;
  args?: Record<string, unknown>;
}

export interface RuntimeStep {
  index: number;
  thought?: string;
  tool: ToolName;
  args?: Record<string, unknown>;
  result: string;
  ok: boolean;
  seconds: number;
}

export interface RuntimeResult {
  answer: string;
  steps: RuntimeStep[];
}

export interface PluginAction {
  id: string;
  label: string;
  code: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  permissions: string[];
  python?: string;
  actions: PluginAction[];
}

export interface InstalledPlugin {
  manifest: PluginManifest;
  files: Record<string, string>;
  installedAt: number;
}

export interface RuntimePluginContext {
  plugin: InstalledPlugin;
  action: PluginAction;
}
