# Scripts Directory

This directory contains utility scripts for the BOB platform.

## User Management

- **[USER_CREATION_GUIDE.md](./USER_CREATION_GUIDE.md)** - Complete guide for creating users and adding admin rights
- **[create-admin-user.js](./create-admin-user.js)** - Node.js script to check/create user and add admin rights
- **[check-and-create-admin-user.sql](./check-and-create-admin-user.sql)** - SQL script to add admin rights to existing user

## Database Setup

- **[complete-setup.js](./complete-setup.js)** - Complete database setup script
- **[run-migrations.js](./run-migrations.js)** - Run database migrations

## Testing

- **[ingest-smoke-test.js](./ingest-smoke-test.js)** - Test data ingestion
- **[retrieve-smoke-test.js](./retrieve-smoke-test.js)** - Test data retrieval

## Build

- **[copy-wasm.js](./copy-wasm.js)** - Copy WASM files for IFC processing (runs on postinstall)

---

## Quick Start: Create Admin User

**Note:** The examples below use `andtheil@gmail.com` (repository owner's email). 
Replace with your own email when setting up your instance.

If you need to create a user with admin rights:

### Option 1: Supabase Dashboard (Easiest)
See [USER_CREATION_GUIDE.md](./USER_CREATION_GUIDE.md#method-1-using-supabase-dashboard--sql-recommended)

### Option 2: Node.js Script
```bash
# 1. Create .env.local with Supabase credentials
# 2. Run the script
node scripts/create-admin-user.js
```

### Option 3: SQL Script
See [check-and-create-admin-user.sql](./check-and-create-admin-user.sql)

For detailed instructions, see **[USER_CREATION_GUIDE.md](./USER_CREATION_GUIDE.md)**.
