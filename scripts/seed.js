require('dotenv').config();

const fs = require('fs');
const path = require('path');
const https = require('https');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const pool = require('../config/db');

const IMAGES_DIR = path.resolve(__dirname, '..', '..', 'images');

if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    https
      .get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return downloadImage(response.headers.location).then(resolve).catch(reject);
        }
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

async function compressAndSave(buffer, filename) {
  const filepath = path.join(IMAGES_DIR, filename);
  await sharp(buffer)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(filepath);
}

async function seed() {
  console.log('Seeding database...\n');

  try {
    await pool.query('DELETE FROM products');
    await pool.query('DELETE FROM categories');
    await pool.query("DELETE FROM users WHERE role != 'admin'");
    console.log('Cleared existing data.\n');

    const hashedPassword = await bcrypt.hash('admin123', 10);

    await pool.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET password = $3, role = $4 RETURNING id, email',
      ['admin', 'admin@shoestore.com', hashedPassword, 'admin']
    );

    console.log('Admin user: admin@shoestore.com / admin123');

    const categories = [
      { name: 'Running' },
      { name: 'Casual' },
      { name: 'Formal' },
      { name: 'Boots' },
      { name: 'Sandals' },
      { name: 'Sports' },
    ];

    const catIds = {};
    for (const cat of categories) {
      const { rows } = await pool.query(
        'INSERT INTO categories (category_name) VALUES ($1) RETURNING id, category_name',
        [cat.name]
      );
      catIds[cat.name] = rows[0].id;
      console.log(`Category: ${cat.name} (id: ${catIds[cat.name]})`);
    }

    console.log('\nDownloading and compressing images...');

    const products = [
      {
        name: 'Air Max Runner', description: 'Lightweight running shoes with air cushioning for maximum comfort.',
        price: 129.99, category: 'Running', gender: 'men', brand: 'Nike',
        sizes: '7,7.5,8,8.5,9,9.5,10,10.5,11,11.5,12', stock_quantity: 25,
        imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
      },
      {
        name: 'Cloud Sneaker', description: 'Everyday comfort with memory foam insole and breathable mesh.',
        price: 89.99, category: 'Casual', gender: 'women', brand: 'Adidas',
        sizes: '5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10', stock_quantity: 30,
        imageUrl: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600',
      },
      {
        name: 'Speed Pro', description: 'High-performance training shoes with advanced grip sole technology.',
        price: 149.99, category: 'Sports', gender: 'men', brand: 'Puma',
        sizes: '7,7.5,8,8.5,9,9.5,10,10.5,11,11.5,12', stock_quantity: 20,
        imageUrl: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600',
      },
      {
        name: 'Classic Canvas', description: 'Timeless canvas design that never goes out of style.',
        price: 59.99, category: 'Casual', gender: 'unisex', brand: 'Converse',
        sizes: '6,7,8,9,10,11,12', stock_quantity: 40,
        imageUrl: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600',
      },
      {
        name: 'Trail Blazer', description: 'All-terrain trail running shoes with rugged outsole.',
        price: 139.99, category: 'Running', gender: 'women', brand: 'New Balance',
        sizes: '5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10', stock_quantity: 15,
        imageUrl: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600',
      },
      {
        name: 'Oxford Leather', description: 'Premium leather oxfords perfect for business and formal occasions.',
        price: 199.99, category: 'Formal', gender: 'men', brand: 'Clarks',
        sizes: '7,7.5,8,8.5,9,9.5,10,10.5,11,11.5,12', stock_quantity: 12,
        imageUrl: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=600',
      },
      {
        name: 'Desert Boot', description: 'Rugged desert boots with premium suede finish.',
        price: 159.99, category: 'Boots', gender: 'men', brand: 'Timberland',
        sizes: '7,7.5,8,8.5,9,9.5,10,10.5,11,11.5,12', stock_quantity: 18,
        imageUrl: 'https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=600',
      },
      {
        name: 'Beach Slide', description: 'Comfortable slides for summer days and poolside lounging.',
        price: 39.99, category: 'Sandals', gender: 'unisex', brand: 'Crocs',
        sizes: '6,7,8,9,10,11,12', stock_quantity: 50,
        imageUrl: 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=600',
      },
      {
        name: 'Street King', description: 'Urban street style with bold design and premium materials.',
        price: 109.99, category: 'Casual', gender: 'men', brand: 'Vans',
        sizes: '7,7.5,8,8.5,9,9.5,10,10.5,11,11.5,12', stock_quantity: 22,
        imageUrl: 'https://images.unsplash.com/photo-1562183241-b937e95585b6?w=600',
      },
      {
        name: 'Winter Grip', description: 'Insulated winter boots with anti-slip sole for icy conditions.',
        price: 179.99, category: 'Boots', gender: 'women', brand: 'Sorel',
        sizes: '5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10', stock_quantity: 10,
        imageUrl: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=600',
      },
      {
        name: 'Kids Sport Star', description: 'Durable sport shoes for active kids with cushioned sole.',
        price: 49.99, category: 'Sports', gender: 'kids', brand: 'Nike',
        sizes: '1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6', stock_quantity: 35,
        imageUrl: 'https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=600',
      },
      {
        name: 'Loafer Luxe', description: 'Elegant loafers with hand-stitched detailing and cushioned insole.',
        price: 169.99, category: 'Formal', gender: 'women', brand: 'Aldo',
        sizes: '5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10', stock_quantity: 14,
        imageUrl: 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=600',
      },
    ];

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const filename = `seed-${String(i + 1).padStart(3, '0')}.webp`;

      try {
        console.log(`  [${i + 1}/${products.length}] Downloading ${p.name}...`);
        const buffer = await downloadImage(p.imageUrl);
        await compressAndSave(buffer, filename);
        console.log(`    Saved: ${filename}`);
      } catch {
        console.log(`    Warning: Could not download image for ${p.name}.`);
      }

      await pool.query(
        `INSERT INTO products (name, brand, sizes, description, price, image_path, category_id, stock_quantity, gender)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [p.name, p.brand, p.sizes, p.description, p.price, filename, catIds[p.category], p.stock_quantity, p.gender]
      );
    }

    console.log('\nSeeding complete!');
    console.log('─────────────────────────────────────────');
    console.log(' Admin Login');
    console.log('   Email:    admin@shoestore.com');
    console.log('   Password: admin123');
    console.log('─────────────────────────────────────────');
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) seed();
