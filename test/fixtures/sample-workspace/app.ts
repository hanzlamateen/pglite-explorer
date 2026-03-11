/**
 * Sample application file that references PGlite databases.
 * Used by PGlite Explorer's source-detection feature during development.
 */
import { PGlite } from '@electric-sql/pglite';

const ecommerceDb = new PGlite('./ecommerce-db');
const blogDb = PGlite.create('./blog-db');

async function main() {
	const products = await ecommerceDb.query('SELECT * FROM products');
	console.log('Products:', products.rows);

	const posts = await blogDb.query('SELECT * FROM posts WHERE published = true');
	console.log('Published posts:', posts.rows);
}

main();
