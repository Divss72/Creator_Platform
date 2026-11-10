# Deployment Guide (v1.0)

CreatorHub v1.0 is packaged as a unified, single-origin full-stack container:

- **Express Backend** + **React 18 SPA Frontend** (`web/dist` served directly by Express).
- Real-time **Socket.io** WebSocket support.
- Automatic migration runner on boot (`scripts/migrate-and-start.js` when `RUN_MIGRATIONS=true`).
- Health check endpoint at `/health`.

---

## Deployment Options

### Option 1: Render.com (Recommended for Free / Quick Hosting)

1. **Create MySQL Database**:
   - Go to [dashboard.render.com](https://dashboard.render.com/) -> **New +** -> **PostgreSQL/MySQL** (or use an external managed MySQL like PlanetScale / Aiven).
   - Copy the database connection details (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`).

2. **Deploy Web Service**:
   - Click **New +** -> **Web Service**.
   - Connect your GitHub repository: `https://github.com/Divss72/Creator_Platform`.
   - Select Branch: `feature/v1.0-analytics-demo` (or `main` after merging).
   - **Environment**: `Docker` (Render automatically detects `Dockerfile`).
   - Add Environment Variables:
     ```ini
     NODE_ENV=production
     PORT=5000
     DB_HOST=<your-db-host>
     DB_PORT=<your-db-port>
     DB_NAME=<your-db-name>
     DB_USER=<your-db-user>
     DB_PASSWORD=<your-db-password>
     JWT_SECRET=<generate-a-random-32-char-secret>
     EMAIL_TOKEN_SECRET=<generate-a-random-32-char-secret>
     CORS_ORIGIN=*
     RUN_MIGRATIONS=true
     STORAGE_DRIVER=fake
     MAIL_DRIVER=log
     FIREBASE_DRIVER=fake
     ALLOW_DEMO_SEED=true
     ```
   - Click **Create Web Service**. Render builds the image, runs migrations, and launches on your `.onrender.com` URL.

---

### Option 2: Railway.app (Zero-Config 1-Click Setup)

1. Open [railway.app](https://railway.app/) and create a new project.
2. Click **New** -> **Database** -> **Add MySQL**.
3. Click **New** -> **GitHub Repo** -> select `Creator_Platform`.
4. In the service **Variables**, link the MySQL environment variables:
   - `DB_HOST`: `${{MySQL.MYSQLHOST}}`
   - `DB_PORT`: `${{MySQL.MYSQLPORT}}`
   - `DB_USER`: `${{MySQL.MYSQLUSER}}`
   - `DB_PASSWORD`: `${{MySQL.MYSQLPASSWORD}}`
   - `DB_NAME`: `${{MySQL.MYSQLDATABASE}}`
   - `RUN_MIGRATIONS`: `true`
   - `JWT_SECRET`: `<your-random-32-char-secret>`
   - `EMAIL_TOKEN_SECRET`: `<your-random-32-char-secret>`
   - `ALLOW_DEMO_SEED`: `true`
5. Railway deploys the Docker container and exposes a public domain with SSL.

---

### Option 3: VPS / Cloud Server (Docker Compose)

Deploy to any Linux server (DigitalOcean, AWS EC2, Hetzner, GCP, Linode):

1. **Clone repository**:

   ```bash
   git clone https://github.com/Divss72/Creator_Platform.git
   cd Creator_Platform
   git checkout feature/v1.0-analytics-demo
   ```

2. **Launch with Production Compose**:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

3. **Verify Deployment**:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   curl http://localhost:5000/health
   ```

---

## Production Security Checklist

- [x] **Secure Cookies & JWT**: Set `JWT_SECRET` to a unique 32+ character string.
- [x] **CORS Origin**: In high-security production environments, restrict `CORS_ORIGIN` to your exact domain (e.g. `https://creatorhub.yourdomain.com`).
- [x] **Non-Root Execution**: Container runs under unprivileged user `node:node` (UID 1000).
- [x] **Health Check**: Automated Docker healthcheck verifies `/health` every 15s.
