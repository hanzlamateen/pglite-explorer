import { PGlite } from '@electric-sql/pglite';

export class ConnectionManager {
	private connections: Map<string, PGlite> = new Map();
	private connecting: Map<string, Promise<PGlite>> = new Map();

	async getConnection(dbPath: string): Promise<PGlite> {
		const existing = this.connections.get(dbPath);
		if (existing) {
			return existing;
		}

		const pending = this.connecting.get(dbPath);
		if (pending) {
			return pending;
		}

		const promise = this.createConnection(dbPath);
		this.connecting.set(dbPath, promise);

		try {
			const conn = await promise;
			this.connections.set(dbPath, conn);
			return conn;
		} finally {
			this.connecting.delete(dbPath);
		}
	}

	private async createConnection(dbPath: string): Promise<PGlite> {
		return new PGlite(dbPath);
	}

	async closeConnection(dbPath: string): Promise<void> {
		const conn = this.connections.get(dbPath);
		if (conn) {
			await conn.close();
			this.connections.delete(dbPath);
		}
	}

	async closeAll(): Promise<void> {
		const closePromises = Array.from(this.connections.entries()).map(
			async ([dbPath, conn]) => {
				try {
					await conn.close();
				} catch {
					// Ignore close errors during shutdown
				}
				this.connections.delete(dbPath);
			}
		);
		await Promise.all(closePromises);
	}

	isConnected(dbPath: string): boolean {
		return this.connections.has(dbPath);
	}
}
