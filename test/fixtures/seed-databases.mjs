/**
 * Seed script that creates sample PGlite databases for development & testing.
 *
 * Run:  node test/fixtures/seed-databases.mjs
 *
 * Creates two databases inside test/fixtures/sample-workspace/:
 *   - ecommerce-db: products, customers, orders
 *   - blog-db:      posts, authors, comments
 */

import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.join(__dirname, 'sample-workspace');

async function seedEcommerce() {
	const dbPath = path.join(WORKSPACE, 'ecommerce-db');
	if (fs.existsSync(dbPath)) {
		fs.rmSync(dbPath, { recursive: true, force: true });
	}

	const db = new PGlite(dbPath);

	await db.exec(`
		CREATE TABLE customers (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			email TEXT UNIQUE NOT NULL,
			city TEXT,
			joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE products (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			price NUMERIC(10,2) NOT NULL,
			stock INTEGER DEFAULT 0,
			category TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE orders (
			id SERIAL PRIMARY KEY,
			customer_id INTEGER REFERENCES customers(id),
			product_id INTEGER REFERENCES products(id),
			quantity INTEGER NOT NULL DEFAULT 1,
			total NUMERIC(10,2),
			status TEXT DEFAULT 'pending',
			ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX idx_products_category ON products(category);
		CREATE INDEX idx_orders_status ON orders(status);
	`);

	const customers = [
		['Alice Johnson', 'alice@example.com', 'New York'],
		['Bob Smith', 'bob@example.com', 'London'],
		['Charlie Lee', 'charlie@example.com', 'Tokyo'],
		['Diana Patel', 'diana@example.com', 'Mumbai'],
		['Eve Martinez', 'eve@example.com', 'Berlin'],
		['Frank Wilson', 'frank@example.com', 'Sydney'],
		['Grace Kim', 'grace@example.com', 'Seoul'],
		['Henry Chen', 'henry@example.com', 'Beijing'],
	];

	for (const [name, email, city] of customers) {
		await db.query(
			'INSERT INTO customers (name, email, city) VALUES ($1, $2, $3)',
			[name, email, city]
		);
	}

	const products = [
		['Mechanical Keyboard', 'Cherry MX switches, RGB backlit', 89.99, 45, 'Electronics'],
		['Wireless Mouse', 'Ergonomic design, 2.4GHz', 34.99, 120, 'Electronics'],
		['USB-C Hub', '7-in-1, HDMI, USB 3.0', 49.99, 78, 'Electronics'],
		['Standing Desk Mat', 'Anti-fatigue, 20x32 inches', 39.99, 200, 'Office'],
		['Notebook A5', 'Dotted grid, 192 pages', 12.99, 500, 'Stationery'],
		['Desk Lamp', 'LED, adjustable color temperature', 29.99, 65, 'Office'],
		['Coffee Mug', 'Ceramic, 12oz, developer themed', 14.99, 300, 'Accessories'],
		['Laptop Stand', 'Aluminum, adjustable height', 44.99, 90, 'Office'],
		['Webcam HD', '1080p, built-in mic, auto-focus', 59.99, 55, 'Electronics'],
		['Blue Light Glasses', 'Anti-strain, lightweight frame', 24.99, 180, 'Accessories'],
	];

	for (const [name, desc, price, stock, category] of products) {
		await db.query(
			'INSERT INTO products (name, description, price, stock, category) VALUES ($1, $2, $3, $4, $5)',
			[name, desc, price, stock, category]
		);
	}

	const orders = [
		[1, 1, 1, 89.99, 'completed'],
		[1, 5, 3, 38.97, 'completed'],
		[2, 2, 1, 34.99, 'shipped'],
		[3, 3, 2, 99.98, 'pending'],
		[4, 7, 4, 59.96, 'completed'],
		[5, 9, 1, 59.99, 'processing'],
		[6, 4, 1, 39.99, 'shipped'],
		[7, 10, 2, 49.98, 'completed'],
		[8, 6, 1, 29.99, 'pending'],
		[2, 8, 1, 44.99, 'completed'],
		[3, 1, 1, 89.99, 'shipped'],
		[5, 7, 2, 29.98, 'pending'],
	];

	for (const [custId, prodId, qty, total, status] of orders) {
		await db.query(
			'INSERT INTO orders (customer_id, product_id, quantity, total, status) VALUES ($1, $2, $3, $4, $5)',
			[custId, prodId, qty, total, status]
		);
	}

	await db.close();
	console.log(`  Created ecommerce-db: 3 tables, ${customers.length} customers, ${products.length} products, ${orders.length} orders`);
}

async function seedBlog() {
	const dbPath = path.join(WORKSPACE, 'blog-db');
	if (fs.existsSync(dbPath)) {
		fs.rmSync(dbPath, { recursive: true, force: true });
	}

	const db = new PGlite(dbPath);

	await db.exec(`
		CREATE TABLE authors (
			id SERIAL PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			display_name TEXT NOT NULL,
			bio TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE posts (
			id SERIAL PRIMARY KEY,
			author_id INTEGER REFERENCES authors(id),
			title TEXT NOT NULL,
			slug TEXT UNIQUE NOT NULL,
			body TEXT NOT NULL,
			published BOOLEAN DEFAULT false,
			tags TEXT[],
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE comments (
			id SERIAL PRIMARY KEY,
			post_id INTEGER REFERENCES posts(id),
			author_name TEXT NOT NULL,
			body TEXT NOT NULL,
			approved BOOLEAN DEFAULT false,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX idx_posts_slug ON posts(slug);
		CREATE INDEX idx_posts_published ON posts(published);
		CREATE INDEX idx_comments_post ON comments(post_id);
	`);

	const authors = [
		['jdoe', 'Jane Doe', 'Full-stack developer and technical writer.'],
		['aturing', 'Alan Turing', 'Pioneer of theoretical computer science.'],
		['grace_h', 'Grace Hopper', 'Computer scientist and US Navy rear admiral.'],
	];

	for (const [username, displayName, bio] of authors) {
		await db.query(
			'INSERT INTO authors (username, display_name, bio) VALUES ($1, $2, $3)',
			[username, displayName, bio]
		);
	}

	const posts = [
		[1, 'Getting Started with PGlite', 'getting-started-pglite', 'PGlite is a lightweight WASM-based PostgreSQL that runs entirely in the browser or Node.js. In this post we explore its capabilities...', true, '{postgresql,wasm,tutorial}'],
		[1, 'Building VS Code Extensions', 'building-vscode-extensions', 'VS Code extensions are powerful tools that can enhance your development workflow. Lets walk through the process step by step...', true, '{vscode,typescript,extensions}'],
		[2, 'The Halting Problem Explained', 'halting-problem-explained', 'The halting problem is a decision problem about properties of computer programs. It asks whether a program will finish running or continue forever...', true, '{theory,computation}'],
		[3, 'Why COBOL Still Matters', 'why-cobol-matters', 'Despite being over 60 years old, COBOL still runs a significant portion of the worlds business transactions. Here is why it matters...', false, '{cobol,legacy,systems}'],
		[2, 'Introduction to Machine Learning', 'intro-machine-learning', 'Machine learning is a subset of AI that enables systems to learn and improve from experience. This primer covers the fundamentals...', true, '{ai,ml,tutorial}'],
	];

	for (const [authorId, title, slug, body, published, tags] of posts) {
		await db.query(
			'INSERT INTO posts (author_id, title, slug, body, published, tags) VALUES ($1, $2, $3, $4, $5, $6)',
			[authorId, title, slug, body, published, tags]
		);
	}

	const comments = [
		[1, 'DevFan42', 'Great intro to PGlite! I have been looking for something like this.', true],
		[1, 'SQLNerd', 'How does this compare to SQLite in terms of performance?', true],
		[2, 'CodeNewbie', 'This tutorial saved me hours of frustration. Thank you!', true],
		[3, 'MathGeek', 'Fascinating explanation. The proof by contradiction is elegant.', true],
		[5, 'DataScientist', 'Good overview, but I would love to see more on neural networks.', false],
		[1, 'SpamBot', 'Check out my amazing product at...', false],
	];

	for (const [postId, authorName, body, approved] of comments) {
		await db.query(
			'INSERT INTO comments (post_id, author_name, body, approved) VALUES ($1, $2, $3, $4)',
			[postId, authorName, body, approved]
		);
	}

	await db.close();
	console.log(`  Created blog-db: 3 tables, ${authors.length} authors, ${posts.length} posts, ${comments.length} comments`);
}

async function main() {
	console.log('Seeding sample PGlite databases...\n');

	fs.mkdirSync(WORKSPACE, { recursive: true });

	await seedEcommerce();
	await seedBlog();

	console.log('\nDone! Databases ready in test/fixtures/sample-workspace/');
	console.log('Press F5 in VS Code to debug with these databases.');
}

main().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
