import { useEffect, useCallback } from 'react';
import { ExtToWebviewMessage, WebviewToExtMessage } from '../../shared/protocol';
import { getVsCodeApi } from './useVsCodeApi';

type MessageHandler = (message: ExtToWebviewMessage) => void;

export function useMessaging(handler: MessageHandler): (msg: WebviewToExtMessage) => void {
	useEffect(() => {
		const listener = (event: MessageEvent<ExtToWebviewMessage>) => {
			handler(event.data);
		};
		window.addEventListener('message', listener);
		return () => window.removeEventListener('message', listener);
	}, [handler]);

	const sendMessage = useCallback((msg: WebviewToExtMessage) => {
		getVsCodeApi().postMessage(msg);
	}, []);

	return sendMessage;
}
