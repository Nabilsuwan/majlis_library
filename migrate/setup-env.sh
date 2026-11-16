#!/bin/sh
# Creates the .env file on the NAS. Generates the random passwords itself
# and asks only for the two values copied from Vercel.
#   sh migrate/setup-env.sh
set -e

if [ -f .env ]; then
  echo ".env already exists — not overwriting it. Delete it first to start over."
  exit 1
fi

rand() { openssl rand -hex 32; }

printf "Paste SESSION_SECRET from Vercel (or press Enter to make a new one): "
read SESSION_SECRET
[ -z "$SESSION_SECRET" ] && SESSION_SECRET=$(rand)

printf "Paste ANTHROPIC_API_KEY from Vercel: "
read ANTHROPIC_API_KEY

cat > .env <<EOF
DB_PASSWORD=$(rand)
SESSION_SECRET=$SESSION_SECRET
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
N8N_ENCRYPTION_KEY=$(rand)
NAS_ROOT=/share/Majlis
EOF
chmod 600 .env

mkdir -p /share/Majlis/covers /share/Majlis/backups
echo ".env created. Keep a copy of N8N_ENCRYPTION_KEY somewhere safe:"
grep N8N_ENCRYPTION_KEY .env
