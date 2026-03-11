import React, { useCallback, useEffect, useRef } from 'react';

interface ExportButtonProps {
	exportData: { data: string; format: 'csv' | 'json'; fileName: string } | null;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ exportData }) => {
	const downloadTriggered = useRef(false);

	const triggerDownload = useCallback(
		(data: string, fileName: string, mimeType: string) => {
			const blob = new Blob([data], { type: mimeType });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = fileName;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		},
		[]
	);

	useEffect(() => {
		if (exportData && !downloadTriggered.current) {
			downloadTriggered.current = true;
			const mimeType =
				exportData.format === 'json' ? 'application/json' : 'text/csv';
			triggerDownload(exportData.data, exportData.fileName, mimeType);
		}
		if (!exportData) {
			downloadTriggered.current = false;
		}
	}, [exportData, triggerDownload]);

	return null;
};
