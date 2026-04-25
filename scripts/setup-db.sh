#!/usr/bin/env bash
# =============================================================================
# setup-db.sh — Aperly database setup script
#
# Run this once after your first deploy (or after wiping the database).
# Requires DATABASE_URL to be set in the environment.
#
# Usage:
#   chmod +x scripts/setup-db.sh
#   DATABASE_URL="postgresql://..." ./scripts/setup-db.sh
#
# Or via npm:
#   npm run db:setup
# =============================================================================

set -euo pipefail

echo ""
echo "=== Aperly DB Setup ==="
echo ""

# -----------------------------------------------------------------------------
# Step 1 — Verify DATABASE_URL is set
# -----------------------------------------------------------------------------
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌  ERROR: DATABASE_URL is not set."
  echo "    Export it before running this script:"
  echo "    export DATABASE_URL=\"postgresql://user:pass@host:5432/aperly?schema=public\""
  exit 1
fi

echo "✅  DATABASE_URL is set."
echo ""

# -----------------------------------------------------------------------------
# Step 2 — Apply all pending migrations (production-safe, no schema reset)
# -----------------------------------------------------------------------------
echo "⏳  Running prisma migrate deploy..."
npx prisma migrate deploy
echo "✅  Migrations applied."
echo ""

# -----------------------------------------------------------------------------
# Step 3 — Seed initial data (skills, subjects, test users)
# -----------------------------------------------------------------------------
echo "⏳  Running prisma db seed..."
npx prisma db seed
echo "✅  Seed data loaded."
echo ""

# -----------------------------------------------------------------------------
# Step 4 — Verify connection by running a quick Prisma query
# -----------------------------------------------------------------------------
echo "⏳  Verifying database connection..."
node --input-type=module <<'EOF'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
try {
  const userCount = await prisma.user.count()
  const skillCount = await prisma.skill.count()
  console.log(`✅  Connection OK — users: ${userCount}, skills: ${skillCount}`)
} catch (err) {
  console.error('❌  Database connection failed:', err.message)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
EOF

echo ""
echo "=== Setup complete! ==="
echo ""
