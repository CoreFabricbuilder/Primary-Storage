import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { selectProject } from '../src/services/storage';

describe('project storage bridge', () => {
  beforeEach(() => invoke.mockReset());

  it('uses only the native project selection command and passes no path from the webview', async () => {
    invoke.mockResolvedValue({ name: 'Example project', schemaVersion: 1 });
    await expect(selectProject()).resolves.toEqual({ name: 'Example project', schemaVersion: 1 });
    expect(invoke).toHaveBeenCalledExactlyOnceWith('select_project');
  });
});
