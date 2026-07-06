# 1HandIndia Production Deployment - Nginx & Node.js Commands

## Nginx Configuration Check

**Test nginx configuration syntax:**
```bash
sudo nginx -t
```

**Reload nginx after config changes:**
```bash
sudo systemctl reload nginx
```

**Restart nginx (if reload doesn't work):**
```bash
sudo systemctl restart nginx
```

**Check nginx status:**
```bash
sudo systemctl status nginx
```

## Nginx Logs

**View nginx error log (for debugging 404/MIME issues):**
```bash
tail -f /var/log/nginx/1handindia-error.log
```

**View nginx access log:**
```bash
tail -f /var/log/nginx/1handindia-access.log
```

**View last 50 lines of error log:**
```bash
tail -50 /var/log/nginx/1handindia-error.log
```

**View last 50 lines of access log:**
```bash
tail -50 /var/log/nginx/1handindia-access.log
```

## Nginx Config Management

**Check which config files are enabled:**
```bash
ls -la /etc/nginx/sites-enabled/
```

**Validate the indihub config specifically:**
```bash
sudo nginx -t -c /etc/nginx/sites-available/indihub-nextjs.conf
```

## Full Deployment Sequence (Run on Production Server)

### Step 1: Copy and Enable Config
```bash
# Copy config file
sudo cp /path/to/deploy/nginx/indihub-nextjs.conf /etc/nginx/sites-available/

# Create symlink to enable
sudo ln -s /etc/nginx/sites-available/indihub-nextjs.conf /etc/nginx/sites-enabled/

# Remove default config if it exists
sudo rm /etc/nginx/sites-enabled/default
```

### Step 2: Validate and Reload Nginx
```bash
# Test syntax
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Check status
sudo systemctl status nginx
```

### Step 3: Build and Run Next.js App
```bash
# Navigate to project
cd /var/www/indihub/ecomm

# Install dependencies
pnpm install

# Generate database client
pnpm db:generate

# Build Next.js app
pnpm build

# Start the app (foreground for testing)
npm start

# Or run in background with PM2
pm2 start npm --name "indihub-web" -- start
pm2 save
```

## Node.js Process Monitoring

**Check if Node.js is listening on port 3000:**
```bash
netstat -tlnp | grep 3000
```

**New systems (netstat might not work):**
```bash
ss -tlnp | grep 3000
```

**Check process details:**
```bash
ps aux | grep node
```

**Kill a Node.js process on port 3000:**
```bash
lsof -i :3000
kill -9 <PID>
```

## PM2 Management (if using PM2)

**Start app with PM2:**
```bash
cd /var/www/indihub/ecomm
pm2 start npm --name "indihub-web" -- start
```

**View PM2 logs:**
```bash
pm2 logs indihub-web
```

**Restart with PM2:**
```bash
pm2 restart indihub-web
```

**Stop with PM2:**
```bash
pm2 stop indihub-web
```

**Delete from PM2:**
```bash
pm2 delete indihub-web
```

**Save PM2 config:**
```bash
pm2 save
pm2 startup
```

## Systemd Service (Alternative to PM2)

**Check systemd service status (if Next.js is managed as a service):**
```bash
sudo systemctl status indihub-web
```

**Start service:**
```bash
sudo systemctl start indihub-web
```

**Stop service:**
```bash
sudo systemctl stop indihub-web
```

**Restart service:**
```bash
sudo systemctl restart indihub-web
```

**View service logs:**
```bash
sudo journalctl -u indihub-web -f
```

## SSL Certificate Check

**List SSL certificates:**
```bash
sudo ls -la /etc/ssl/certs/ | grep 1handindia
sudo ls -la /etc/ssl/private/ | grep 1handindia
```

**Check certificate expiry:**
```bash
sudo openssl x509 -in /etc/ssl/certs/1handindia.com.crt -text -noout | grep -A 2 "Validity"
```

## Quick Troubleshooting Sequence

**If 404 errors persist:**
```bash
# 1. Check nginx syntax
sudo nginx -t

# 2. Check if Node.js is running
ss -tlnp | grep 3000

# 3. Check nginx error log
tail -50 /var/log/nginx/1handindia-error.log

# 4. Check nginx access log
tail -50 /var/log/nginx/1handindia-access.log

# 5. Check Node.js app logs
pm2 logs indihub-web
# or
sudo journalctl -u indihub-web -f

# 6. Reload nginx
sudo systemctl reload nginx
```

## Environment Variables

**Check if .env.production exists and is loaded:**
```bash
ls -la /var/www/indihub/ecomm/.env*
cat /var/www/indihub/ecomm/.env.production
```

**Set critical env vars before starting:**
```bash
export NODE_ENV=production
export NEXT_PUBLIC_API_URL=https://1handindia.com/api
```

## Performance Check

**Check server resource usage:**
```bash
top
free -h
df -h
```

**Check nginx worker processes:**
```bash
ps aux | grep nginx
```
