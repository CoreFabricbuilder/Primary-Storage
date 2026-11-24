import { invoke } from '@tauri-apps/api/core';
import type { ProjectInfo } from '../models/project';

export function selectProject(): Promise<ProjectInfo | null> {
  return invoke<ProjectInfo | null>('select_project');
}
