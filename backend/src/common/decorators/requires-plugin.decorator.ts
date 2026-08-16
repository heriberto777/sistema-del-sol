import { SetMetadata } from '@nestjs/common';

export const REQUIRES_PLUGIN_KEY = 'requires_plugin';
export const RequiresPlugin = (pluginKey: string) => SetMetadata(REQUIRES_PLUGIN_KEY, pluginKey);
