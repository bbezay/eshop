# Shoe Store Backend API

Full-featured backend API for a Shoe Store ecommerce application built with **Express.js**, **PostgreSQL**, and **Node.js**.

## Table of Contents

- [Prerequisites](#prerequisites)
- [System Requirements](#system-requirements)
- [PostgreSQL Setup](#postgresql-setup)
  - [Windows](#windows)
  - [macOS (Homebrew)](#macos-homebrew)
  - [Linux (APT)](#linux-apt)
  - [Docker](#docker)
- [Project Setup](#project-setup)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Image Handling](#image-handling)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | v18+ | JavaScript runtime |
| **npm** | v9+ | Package manager (comes with Node.js) |
| **PostgreSQL** | v14+ | Relational database |

> This project uses native Node.js `--watch` flag (available in Node.js v18.11+) for development auto-reload. No `nodemon` required.

---

## System Requirements

- **OS**: Windows 10/11, macOS 12+, or Linux (Ubuntu 20.04+, Debian 11+)
- **RAM**: 2GB minimum, 4GB recommended
- **Disk**: 1GB free space (for `node_modules`, images, and database)
- **Network**: Internet connection required for downloading seed product images

---

## PostgreSQL Setup

### Windows

**Option A: Official Installer**
1. Download from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
2. Run the installer and follow the setup wizard
3. Remember the password you set for the `postgres` user

**Option B: Chocolatey**
```powershell
choco install postgresql
```

**Option C: winget**
```powershell
winget install PostgreSQL.PostgreSQL
```

After installation, PostgreSQL service should start automatically. Verify:
```powershell
psql -U postgres -c "SELECT version();"
```

### macOS (Homebrew)

```bash
brew install postgresql@16
brew services start postgresql@16
```

### Linux (APT)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Docker

```bash
docker run --name pg-shoestore \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=myshop_db \
  -p 5432:5432 \
  -d postgres:16
```

---

## Project Setup

### 1. Clone the Repository

```bash
git clone <repo-url>
cd shoe-store-be
```

### 2. Install Dependencies

```bash
npm install
```

This installs all production dependencies including `express`, `pg`, `sharp` (for image compression), `bcryptjs`, `jsonwebtoken`, `multer`, `cors`, and `dotenv`.

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
PORT=5003
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=myshop_db
JWT_SECRET=your_jwt_secret_here
```

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5003` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | — |
| `DB_NAME` | Database name | `myshop_db` |
| `JWT_SECRET` | JWT signing secret | — |

> The frontend expects the backend to run on **port 5003**. If you change this, also update `API_BASE` in the frontend `src/config.ts`.

### 4. Create the Database

**Cross-platform (Node.js script — recommended):**
```bash
npm run create-db
```

This script connects to the default `postgres` database and creates `myshop_db` (or the value of `DB_NAME` from `.env`). It works on Windows, macOS, and Linux.

**Alternative — using `psql`:**

macOS/Linux:
```bash
psql -U postgres -c "CREATE DATABASE myshop_db;"
```

Windows (PowerShell / Command Prompt):
```powershell
psql -U postgres -c "CREATE DATABASE myshop_db;"
```

If `psql` is not in your PATH on Windows, use the full path:
```powershell
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE myshop_db;"
```

**Alternative — using `createdb`:**
```bash
createdb myshop_db
```

### 5. Run Database Migrations

```bash
npm run migrate
```

This creates all tables (`users`, `categories`, `products`, `addresses`, `cart_items`, `orders`, `order_items`) plus auto-update triggers. A `migrations` tracking table prevents re-running completed migrations.

**Available migration commands:**

| Command | Description |
|---------|-------------|
| `npm run migrate` | Run all pending `.up.sql` files |
| `npm run migrate:rollback` | Roll back the last executed migration |

### 6. Seed Default Data

```bash
npm run seed
```

This creates:
- **Admin user**: `admin@shoestore.com` / `admin123` (role: admin)
- **6 categories**: Running, Casual, Formal, Boots, Sandals, Sports
- **12 products** with real images downloaded from Unsplash, compressed to WebP (80% quality), and saved to the external `images/` folder

Re-running the seed clears existing products/categories (but preserves admin users) and is safe for repeated use.

> The seed script downloads product images from the internet. If you are offline, seeding will complete but products will have no images.

### 7. One-Command Setup

```bash
npm run setup
```

Runs `create-db` + `migrate` + `seed` in sequence.

### 8. Start the Server

Production:
```bash
npm start
```

Development (with auto-reload via `node --watch`):
```bash
npm run dev
```

The server runs on `http://localhost:5003` by default.

---

## Image Handling

Product images are stored **outside the project directory** in a shared `images/` folder at the workspace root (sibling to `shoe-store-be/` and `shoestore-fe/`):

```
/workspace-root/
  images/          <-- Product images (WebP, compressed)
  shoe-store-be/   <-- Backend repo
  shoestore-fe/    <-- Frontend repo
```

- **Upload**: Multer receives the image in memory → `sharp` resizes to max 1200x1200 → converts to WebP (80% quality) → saves to `images/`
- **Serving**: Express serves `images/` statically at `GET /images/:filename`
- **Frontend**: Images are loaded from `http://localhost:5003/images/:filename`
- **Required**: Every product **must** have an image. The API returns `400` if no image is provided.

---

## API Documentation

### Authentication

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `POST` | `/api/auth/register` | None | — | Register a new customer |
| `POST` | `/api/auth/login` | None | — | Login, returns JWT |
| `GET` | `/api/auth/me` | Bearer | — | Get current user profile |
| `PUT` | `/api/auth/me` | Bearer | — | Update profile / change password |
| `DELETE` | `/api/auth/users/:id` | Bearer | Admin | Soft-delete a user |
| `PATCH` | `/api/auth/users/:id/status` | Bearer | Admin | Toggle user active status |

### Products

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `GET` | `/api/shoes` | None | — | List products (supports filters, sort, pagination) |
| `GET` | `/api/shoes/:id` | None | — | Get single product detail |
| `POST` | `/api/shoes` | Bearer | Admin | Create product (multipart: image + fields) |
| `DELETE` | `/api/shoes/:id` | Bearer | Admin | Delete a product |

**Query parameters for `GET /api/shoes`:**
- `?gender=men|women|kids|unisex` — filter by gender
- `?category=Running` — filter by category name
- `?search=sneaker` — search in name/description
- `?sort=price-asc|price-desc|newest|name-asc` — sort order
- `?page=1&limit=12` — pagination

### Cart

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/cart` | Bearer | Get user's cart with product details |
| `POST` | `/api/cart` | Bearer | Add item to cart |
| `PUT` | `/api/cart/:id` | Bearer | Update item quantity |
| `DELETE` | `/api/cart/:id` | Bearer | Remove item |
| `DELETE` | `/api/cart` | Bearer | Clear entire cart |

### Addresses

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/addresses` | Bearer | List user's addresses |
| `POST` | `/api/addresses` | Bearer | Add address |
| `PUT` | `/api/addresses/:id` | Bearer | Update address |
| `DELETE` | `/api/addresses/:id` | Bearer | Delete address |

### Orders (Checkout)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/orders` | Bearer | Place order from cart |
| `GET` | `/api/orders` | Bearer | Get order history |
| `GET` | `/api/orders/:id` | Bearer | Get order details |

### Categories

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/categories` | None | List all categories |

### Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/health` | None | Server and database health check |

---

## Database Schema

### `users`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | SERIAL | PRIMARY KEY |
| `username` | VARCHAR(255) | NOT NULL, UNIQUE |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE |
| `password` | VARCHAR(255) | NOT NULL (bcrypt hashed) |
| `role` | VARCHAR(20) | NOT NULL, DEFAULT 'customer', CHECK (admin, customer) |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE |
| `deleted_at` | TIMESTAMPTZ | NULL (soft-delete) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

### `categories`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | SERIAL | PRIMARY KEY |
| `category_name` | VARCHAR(255) | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

### `products`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | SERIAL | PRIMARY KEY |
| `name` | VARCHAR(255) | NOT NULL |
| `brand` | VARCHAR(100) | NULL |
| `sizes` | TEXT | NULL (comma-separated, e.g. "7,7.5,8,8.5,9") |
| `description` | TEXT | NULL |
| `price` | NUMERIC(10,2) | NOT NULL |
| `image_path` | VARCHAR(255) | NOT NULL |
| `category_id` | INTEGER | FOREIGN KEY → categories(id) ON DELETE SET NULL |
| `stock_quantity` | INTEGER | NOT NULL, DEFAULT 0 |
| `gender` | VARCHAR(10) | DEFAULT 'unisex', CHECK (men, women, kids, unisex) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

### `addresses`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | SERIAL | PRIMARY KEY |
| `user_id` | INTEGER | NOT NULL, FOREIGN KEY → users(id) ON DELETE CASCADE |
| `type` | VARCHAR(20) | DEFAULT 'shipping', CHECK (shipping, billing) |
| `full_name` | VARCHAR(255) | NOT NULL |
| `phone` | VARCHAR(30) | NULL |
| `street` | VARCHAR(255) | NOT NULL |
| `city` | VARCHAR(100) | NOT NULL |
| `state` | VARCHAR(100) | NOT NULL |
| `zip` | VARCHAR(20) | NOT NULL |
| `country` | VARCHAR(100) | NOT NULL, DEFAULT 'United States' |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

### `cart_items`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | SERIAL | PRIMARY KEY |
| `user_id` | INTEGER | NOT NULL, FOREIGN KEY → users(id) ON DELETE CASCADE |
| `product_id` | INTEGER | NOT NULL, FOREIGN KEY → products(id) ON DELETE CASCADE |
| `quantity` | INTEGER | NOT NULL, DEFAULT 1, CHECK (> 0) |
| `size` | VARCHAR(20) | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| **Unique** | | `(user_id, product_id, size)` |

### `orders`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | SERIAL | PRIMARY KEY |
| `user_id` | INTEGER | NOT NULL, FOREIGN KEY → users(id) ON DELETE CASCADE |
| `shipping_address_id` | INTEGER | FOREIGN KEY → addresses(id) ON DELETE SET NULL |
| `billing_address_id` | INTEGER | FOREIGN KEY → addresses(id) ON DELETE SET NULL |
| `subtotal` | NUMERIC(10,2) | NOT NULL |
| `tax` | NUMERIC(10,2) | NOT NULL |
| `shipping_cost` | NUMERIC(10,2) | NOT NULL, DEFAULT 0 |
| `total` | NUMERIC(10,2) | NOT NULL |
| `payment_info` | JSONB | NULL (stores card last4, brand) |
| `status` | VARCHAR(20) | DEFAULT 'pending', CHECK (pending, confirmed, shipped, delivered, cancelled) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

### `order_items`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | SERIAL | PRIMARY KEY |
| `order_id` | INTEGER | NOT NULL, FOREIGN KEY → orders(id) ON DELETE CASCADE |
| `product_id` | INTEGER | NOT NULL |
| `product_name` | VARCHAR(255) | NOT NULL |
| `quantity` | INTEGER | NOT NULL, CHECK (> 0) |
| `price_at_time` | NUMERIC(10,2) | NOT NULL |
| `size` | VARCHAR(20) | NULL |
| `image_path` | VARCHAR(255) | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

> All tables have an automatic `updated_at` trigger that sets the column to `CURRENT_TIMESTAMP` on every row update.

---

## Project Structure

```
shoe-store-be/
├── .env                          # Environment variables
├── .gitignore
├── package.json                  # Dependencies & scripts
├── package-lock.json
├── server.js                     # Express app entry point
├── config/
│   └── db.js                     # PostgreSQL connection pool
├── controllers/
│   ├── authController.js         # Register, login, profile
│   ├── cartController.js         # Cart CRUD
│   ├── addressController.js      # Address CRUD
│   ├── orderController.js        # Checkout & orders
│   ├── productController.js      # Product CRUD + filtering
│   ├── categoryController.js     # Categories list
│   └── healthController.js       # Health check
├── middleware/
│   ├── authMiddleware.js         # JWT verify + admin check
│   └── uploadMiddleware.js       # Multer + sharp image processing
├── routes/
│   ├── authRoutes.js
│   ├── cartRoutes.js
│   ├── addressRoutes.js
│   ├── orderRoutes.js
│   ├── productRoutes.js
│   ├── categoryRoutes.js
│   └── healthRoutes.js
├── migrations/                   # SQL migration files (up/down pairs)
│   ├── 001_create-users.{up,down}.sql
│   ├── 002_create-categories.{up,down}.sql
│   ├── 003_create-products.{up,down}.sql
│   ├── 004_add-product-fields.{up,down}.sql
│   ├── 005_create-addresses.{up,down}.sql
│   ├── 006_create-cart-items.{up,down}.sql
│   ├── 007_create-orders.{up,down}.sql
│   ├── 008_create-order-items.{up,down}.sql
│   ├── 009_add-gender-to-products.{up,down}.sql
│   └── 010_change-size-to-sizes.{up,down}.sql
└── scripts/
    ├── create-db.js              # Cross-platform DB creation
    ├── migrate.js                # Custom migration runner
    └── seed.js                   # Database seeder
```

**External folder (created at runtime):**
```
../images/                        # Product images (WebP, compressed by sharp)
```

---

## Environment Variables

See [Project Setup > Configure Environment Variables](#3-configure-environment-variables) above for the full `.env` template.

---

## Security

- All SQL queries use **parameterized queries** (`$1, $2` syntax) to prevent SQL injection.
- Passwords are hashed with **bcryptjs** (10 salt rounds) before storage.
- JWT-based authentication with 24-hour token expiry.
- Admin-only middleware protects sensitive routes (user management, product create/delete).
- Images are compressed and converted to WebP using `sharp` to prevent malicious uploads.
- Only filename strings are stored in the database; files are served statically.
- CORS is enabled for all origins in development.

---

## Frontend Setup

This backend is designed to work with the companion frontend at `../shoestore-fe/`.

See the [frontend README](../shoestore-fe/README.md) for setup instructions.

---

## License

MIT
