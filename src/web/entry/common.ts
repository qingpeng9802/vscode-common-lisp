
import { UpdateInfo } from './UpdateInfo';
import { UpdateCache } from './UpdateCache';
import { WorkspaceConfig } from './WorkspaceConfig';

const needUpdateSet = new Set<string>();
const updateCache = new UpdateCache();
const updateInfo = new UpdateInfo();
const workspaceConfig = new WorkspaceConfig();

export { needUpdateSet, updateCache, updateInfo, workspaceConfig };