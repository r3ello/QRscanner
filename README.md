# Door Scanner — QR Check-in PWA

A minimal, static-file PWA that turns any phone into a fast QR code scanner for event door check-in. No build step required.

## File Structure

```
QRscanner/
├── index.html              # App shell
├── app.js                  # Scanner logic, API calls, feedback
├── styles.css              # Dark theme, responsive layout
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # Service worker (offline caching)
├── icon-192.png            # App icon 192×192 (you must create)
├── icon-512.png            # App icon 512×512 (you must create)
└── README.md
```

## Quick Start

1. **Create app icons** (required for PWA install prompt):

   Use any image editor or generate simple icons with ImageMagick:

   ```bash
   convert -size 192x192 xc:'#1a1a2e' -fill white -gravity center \
     -font Arial-Bold -pointsize 64 -annotate +0+0 'QR' icon-192.png

   convert -size 512x512 xc:'#1a1a2e' -fill white -gravity center \
     -font Arial-Bold -pointsize 170 -annotate +0+0 'QR' icon-512.png
   ```

   Or use any 192×192 and 512×512 PNG images of your choice.

2. **Deploy the files** to your web server (see Nginx section below).

3. **Open the app** on a phone over HTTPS.

4. **Set the Scanner Key** in Settings (the `X-Scanner-Key` header value).

5. **Tap Start Camera**, allow camera permission, and start scanning.

---

## Nginx / EasyPanel Configuration

The PWA and the check-in API must be on the **same domain** to avoid CORS issues. Nginx serves the static files and proxies `/api/checkin` to your n8n webhook.

### Example Nginx Config

```nginx
server {
    listen 443 ssl http2;
    server_name checkin.example.com;

    ssl_certificate     /etc/ssl/certs/checkin.example.com.pem;
    ssl_certificate_key /etc/ssl/private/checkin.example.com.key;

    # ── Static PWA files ──────────────────────
    root /var/www/qrscanner;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # ── Proxy check-in API to n8n webhook ─────
    location /api/checkin {
        # Optional: validate scanner key at Nginx level
        # if ($http_x_scanner_key != "YOUR_SECRET_KEY") {
        #     return 403 '{"status":"error","message":"Forbidden"}';
        # }

        proxy_pass http://n8n:5678/webhook/checkin;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Scanner-Key $http_x_scanner_key;
        proxy_read_timeout 10s;
    }
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name checkin.example.com;
    return 301 https://$host$request_uri;
}
```

### EasyPanel

If using EasyPanel with Docker:

1. Add the static files as a service (e.g., Nginx container) or mount them into an existing web server container.
2. Add a custom Nginx config or use EasyPanel's proxy rules to route `/api/checkin` to your n8n service (typically `http://n8n:5678/webhook/checkin`).
3. EasyPanel handles HTTPS via Let's Encrypt automatically.

---

## n8n Webhook Setup

Create an n8n workflow with a **Webhook** node:

- **Method:** POST
- **Path:** `/webhook/checkin`
- **Response Mode:** "Last Node" or manual response

The webhook receives:

```json
{
    "token": "abc123-def456"
}
```

Headers include `X-Scanner-Key` for authentication.

### Expected Response

Return JSON with at least a `status` field:

```json
{
    "status": "ok",
    "message": "Welcome!",
    "name": "John Smith"
}
```

| HTTP Status | `status` value | Meaning                          |
|-------------|----------------|----------------------------------|
| 200         | `"ok"`         | Check-in successful              |
| 409         | `"used"`       | Ticket already scanned           |
| 400         | `"invalid"`    | Token not recognized             |
| 403         | `"error"`      | Wrong/missing scanner key        |
| 429         | `"error"`      | Rate limited                     |
| 5xx         | `"error"`      | Server error                     |

The `name` or `attendee` field (string or `{ name: string }`) is displayed on the feedback screen when present.

---

## HTTPS Requirement

Camera access (`getUserMedia`) requires a **secure context**:

- `https://` — works
- `http://localhost` — works (for local testing)
- `http://` on any other host — **camera will not work**

Use Let's Encrypt / Certbot / EasyPanel for free TLS certificates.

---

## iOS Safari Notes

- On first visit, Safari shows a camera permission dialog — tap **Allow**.
- If denied, go to **Settings → Safari → Camera** and set to **Allow**.
- To install as a home-screen app: tap the **Share** button → **Add to Home Screen**.
- iOS may re-prompt for camera permission after updates.

---

## Security Notes

- The `X-Scanner-Key` header is a shared secret sent with every API request. It is **not** a substitute for proper authentication, but it prevents casual abuse.
- The key is stored in `localStorage` on the device. Anyone who inspects the page can read it.
- **Rotate the key** periodically: update it in n8n (or Nginx) and on each scanner device via Settings.
- For stronger security, consider adding device-specific tokens or short-lived JWTs.

---

## Test Mode

For local testing without a real n8n backend, you can mock the API:

### Option A: Simple HTTP server + mock endpoint

Use any static file server for the PWA and a small mock for the API:

```bash
# Terminal 1: serve static files
npx serve .

# Terminal 2: mock API (Node one-liner)
node -e "
const http = require('http');
http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    console.log('Check-in:', body);
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({status:'ok', message:'Welcome!', name:'Test User'}));
  });
}).listen(3001);
console.log('Mock API on :3001');
"
```

Then either configure Nginx to proxy `/api/checkin` to `localhost:3001`, or temporarily change `API_ENDPOINT` in `app.js`.

### Option B: Modify app.js directly

Replace the `fetch` call in `processCheckin()` with a mock response:

```js
// Mock — remove before production
const res = { ok: true, status: 200, json: async () => ({ status: "ok", message: "Welcome!", name: "Test User" }) };
```

---

## Updating the App

1. Deploy new files to the server.
2. Bump `CACHE_VERSION` in `sw.js` (e.g., `"door-scanner-v2"`).
3. The service worker will detect the change, cache new assets, and activate on the next page load.
