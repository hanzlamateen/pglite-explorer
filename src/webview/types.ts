export type ViewTab = 'data' | 'sql' | 'schema';

export interface AppState {
	selectedDb: string | null;
	selectedTable: string | null;
	activeTab: ViewTab;
}

declare global {
	interface Window {
		__PGLITE_CONFIG__?: {
			pageSize: number;
			initialDb?: string | null;
			initialTable?: string | null;
		};
	}
}
