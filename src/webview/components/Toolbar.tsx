import React from 'react';
import { ViewTab } from '../types';

interface ToolbarProps {
	activeTab: ViewTab;
	onTabChange: (tab: ViewTab) => void;
	onRefresh: () => void;
	onExport?: (format: 'csv' | 'json') => void;
	hasTable: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
	activeTab,
	onTabChange,
	onRefresh,
	onExport,
	hasTable,
}) => {
	const tabs: { id: ViewTab; label: string }[] = [
		{ id: 'data', label: 'Data' },
		{ id: 'sql', label: 'SQL Editor' },
		{ id: 'schema', label: 'Schema' },
	];

	return (
		<div className="toolbar">
			<div className="toolbar-tabs">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						className={`toolbar-tab ${activeTab === tab.id ? 'active' : ''}`}
						onClick={() => onTabChange(tab.id)}
					>
						{tab.label}
					</button>
				))}
			</div>
			<div className="toolbar-actions">
				{hasTable && onExport && (
					<div className="export-dropdown">
						<button
							className="toolbar-btn"
							onClick={() => onExport('csv')}
							title="Export as CSV"
						>
							CSV
						</button>
						<button
							className="toolbar-btn"
							onClick={() => onExport('json')}
							title="Export as JSON"
						>
							JSON
						</button>
					</div>
				)}
				<button className="toolbar-btn" onClick={onRefresh} title="Refresh">
					↻ Refresh
				</button>
			</div>
		</div>
	);
};
