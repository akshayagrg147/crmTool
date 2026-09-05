# Deploy TalkoCRM to one EC2 instance

This setup runs the React frontend, FastAPI backend, and PostgreSQL on one EC2
instance. It is suitable for an initial low-traffic deployment. PostgreSQL is
only reachable inside the Docker network; Caddy exposes ports 80 and 443 and
automatically manages the TLS certificate for the configured domain.

## 1. EC2 prerequisites

- Amazon Linux 2023
- A Free Tier eligible instance type
- Security group rules: SSH 22 from your IP, HTTP 80 and HTTPS 443 from the internet
- DNS A records for the root domain and `www` pointing to the instance
- Encrypted gp3 root volume
- A key pair stored only on your computer

For organization logos, create a private S3 bucket in the same region and
attach a least-privilege IAM role to the EC2 instance. The role needs
`s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` for
`arn:aws:s3:::YOUR_BUCKET/organizations/*`. Keep S3 Block Public Access
enabled; the application proxies logos through short-lived signed URLs.

## 2. Install Docker and Git

Connect to the instance using the EC2 console or your private key, then run:

```bash
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
```

Log out and reconnect once so the Docker group change takes effect.

## 3. Put the code on the server

Clone the repository after the production deployment files and current UI
changes have been pushed:

```bash
git clone https://github.com/akshayagrg147/crmTool.git
cd crmTool
```

## 4. Create production secrets

```bash
cp .env.production.example .env.production
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
```

Use the three different values for `POSTGRES_PASSWORD`, `JWT_SECRET`, and
`INTEGRATION_ENCRYPTION_KEY`. Replace `YOUR_EC2_PUBLIC_IP` with the instance's
public IPv4 address. Do not paste the secrets into chat or commit the file.
Set `S3_BUCKET` to the private logo bucket and `S3_REGION` to its AWS region.
The EC2 IAM role supplies credentials automatically; no access keys are needed
in `.env.production`.

## 5. Start the application

```bash
docker compose --env-file .env.production -f compose.prod.yml up -d --build
docker compose --env-file .env.production -f compose.prod.yml ps
curl --fail http://127.0.0.1/api/health
```

Open `https://talkocrm.com` in a browser. Caddy obtains the certificate after
both DNS records resolve to the instance. The first backend startup runs all
Alembic migrations automatically.

The `attendance-closer` service must also show as running. It automatically
closes any forgotten check-in at 12:00 AM in `ATTENDANCE_TIMEZONE`:

```bash
docker compose --env-file .env.production -f compose.prod.yml ps attendance-closer
docker compose --env-file .env.production -f compose.prod.yml logs --tail=50 attendance-closer
```

Do not run `seed.py` in a real production environment because it creates known
demo passwords. Create the first production super admin with a random password
that never appears in shell history:

```bash
umask 077
openssl rand -base64 24 > initial-super-admin-password.txt
BOOTSTRAP_SUPER_ADMIN_PHONE=YOUR_LOGIN_PHONE \
  docker compose --env-file .env.production -f compose.prod.yml exec -T \
  -e BOOTSTRAP_SUPER_ADMIN_PHONE=YOUR_LOGIN_PHONE \
  -e BOOTSTRAP_SUPER_ADMIN_NAME="Platform Owner" \
  backend python bootstrap_super_admin.py < initial-super-admin-password.txt
```

Read the password directly on the server, sign in, and then store it in a
password manager. The bootstrap command becomes a no-op after the first super
admin exists.

## 6. Operations

View logs:

```bash
docker compose --env-file .env.production -f compose.prod.yml logs -f --tail=200
```

Deploy a later update:

```bash
git pull --ff-only
docker compose --env-file .env.production -f compose.prod.yml up -d --build
docker compose --env-file .env.production -f compose.prod.yml ps attendance-closer
```

Stop the stack without deleting data:

```bash
docker compose --env-file .env.production -f compose.prod.yml down
```

The PostgreSQL data remains in the `districall_postgres_data` Docker volume.
Do not add `-v` to the `down` command unless you intentionally want to delete
the production database.

## 7. Before real customer use

- Point a domain to the instance and add HTTPS.
- Add automated encrypted database backups.
- Replace the single-instance PostgreSQL container with managed PostgreSQL when
  reliability requirements justify the additional cost.
- Create an AWS budget alert and monitor disk usage.
