// AI-generated (Claude)
// What the Settings section says about the MCP server, decided apart from the
// screen so it can be tested.


import { t } from '@/i18n';

/** The server's state as the label needs it; see src/lib/mcp/server.ts. */
export type McpStatus =
  | { status: 'off'; error: string | null }
  | { status: 'starting' }
  | { status: 'running' }
  | { status: 'interrupted'; error: string | null };

/** `urlCount`: how many addresses the server can be reached on right now. */
export function mcpStatusLabel(server: McpStatus, urlCount: number): string {
  switch (server.status) {
    case 'running':
      return urlCount > 0 ? t('mcp.status.running') : t('mcp.status.runningNoNetwork');
    case 'starting':
      return t('mcp.status.starting');
    case 'interrupted':
      // Restarted on the way back to the foreground; this shows in between.
      return server.error ? t('mcp.status.interruptedError', { error: server.error }) : t('mcp.status.interrupted');
    case 'off':
      return server.error ? t('mcp.status.couldNotStart', { error: server.error }) : t('mcp.status.off');
  }
}
