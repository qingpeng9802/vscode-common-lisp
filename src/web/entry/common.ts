
import { UpdateInfo } from './UpdateInfo';
import { UpdateCache } from './UpdateCache';
import { WorkspaceConfig } from './WorkspaceConfig';

const needUpdateSet: Set<string> = new Set();

const updateCache = new UpdateCache();

const updateInfo = new UpdateInfo();

const workspaceConfig: WorkspaceConfig = new WorkspaceConfig();

export {needUpdateSet, updateCache, updateInfo, workspaceConfig};