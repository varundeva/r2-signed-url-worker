# r2-signed-url-worker

**Secure, time-limited access to private Cloudflare R2 objects using signed URLs**

---

## Table of Contents

* [Why This Project Exists](#why-this-project-exists)
* [What Problem It Solves](#what-problem-it-solves)
* [Core Concepts](#core-concepts)
* [Features](#features)
* [How It Works](#how-it-works)
* [Architecture](#architecture)
* [Prerequisites](#prerequisites)
* [Installation & Deployment](#installation--deployment)
* [R2 Bucket Configuration](#r2-bucket-configuration)
* [Environment Configuration](#environment-configuration)
* [Signed URL Format](#signed-url-format)
* [Backend Integration](#backend-integration)
* [Frontend Usage](#frontend-usage)
* [Next.js Integration](#nextjs-integration)
* [Download vs Image Rendering](#download-vs-image-rendering)
* [Security Model](#security-model)
* [Expiration & Revocation](#expiration--revocation)
* [Common Use Cases](#common-use-cases)
* [Performance Considerations](#performance-considerations)
* [Limitations](#limitations)
* [Extending the Worker](#extending-the-worker)
* [Best Practices](#best-practices)
* [FAQ](#faq)
* [License](#license)

---

## Why This Project Exists

Cloudflare R2 **does not support native signed URLs or expiring public links**.

If you make an R2 bucket public:

* Files are accessible forever
* URLs cannot be revoked
* Anyone can hotlink or scrape content
* Privacy and security risks increase

This project provides a **secure access layer** in front of R2 that enables **time-limited, revocable access** to private files without proxying data through your backend.

---

## What Problem It Solves

This worker solves the following real-world problems:

* ❌ No native signed URLs in R2
* ❌ No expiry for public R2 objects
* ❌ Cannot use auth headers in `<img>` tags
* ❌ Backend file proxying does not scale
* ❌ Permanent public exposure of private files

✅ **Solution:**
A stateless Cloudflare Worker that validates signed URLs and securely serves private R2 objects with enforced expiry.

---

## Core Concepts

| Concept                    | Explanation                                |
| -------------------------- | ------------------------------------------ |
| **Private R2 bucket**      | Objects are never publicly accessible      |
| **Signed URL**             | URL contains a cryptographic signature     |
| **Expiry timestamp**       | URL stops working automatically            |
| **Stateless verification** | No DB or KV needed                         |
| **Edge delivery**          | Files served directly from Cloudflare edge |

---

## Features

### ✅ Core Features

* Time-limited access to private R2 objects
* Works with `<img>`, `<Image />`, and downloads
* No authentication headers required
* No backend bandwidth usage
* No database changes required
* Fully stateless
* Edge-delivered (fast & scalable)

### ✅ Security Features

* HMAC-SHA256 signature validation
* Enforced expiry timestamp
* Private bucket enforcement
* Hotlink protection (by expiry)
* Cache prevention for signed URLs

### ✅ Developer Features

* Backend-agnostic (Node, Next.js, NestJS, Go, etc.)
* Simple URL format
* Minimal configuration
* Easy to extend
* Open-source (MIT)

---

## How It Works

1. Your backend generates a signed URL with:

   * object key
   * expiry timestamp
   * HMAC signature
2. Browser requests the signed URL
3. Worker:

   * validates signature
   * checks expiry
   * fetches object from R2
4. File is streamed to the browser
5. After expiry → access denied (403)

---

## Architecture

```
Database
  └─ stores: avatars/user123.png

Backend
  └─ generates signed URL (short-lived)

Cloudflare Worker
  └─ validates signature + expiry
  └─ fetches object from R2

Browser
  └─ <img src="signed-url" />
```

---

## Prerequisites

* Cloudflare account
* R2 bucket created
* Node.js ≥ 18
* Wrangler CLI installed
* A domain or subdomain (optional but recommended)

---

## Installation & Deployment

### Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

### Clone Repository

```bash
git clone https://github.com/yourname/r2-signed-url-worker.git
cd r2-signed-url-worker
npm install
```

### Deploy Worker

```bash
wrangler deploy
```

---

## R2 Bucket Configuration

**Important:** Bucket must be private.

Cloudflare Dashboard → R2 → Bucket → Settings
❌ Disable public access

---

## Environment Configuration

### `wrangler.toml`

```toml
name = "r2-signed-url-worker"
main = "src/index.js"
compatibility_date = "2024-11-01"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "your-bucket-name"

[vars]
SIGNING_SECRET = "LONG_RANDOM_SECRET"
```

---

## Signed URL Format

```
https://files.example.com
  ?key=avatars/user123.png
  &exp=1700000000
  &sig=BASE64_SIGNATURE
```

### Parameters

| Param | Description              |
| ----- | ------------------------ |
| `key` | R2 object key            |
| `exp` | UNIX timestamp (seconds) |
| `sig` | HMAC-SHA256 signature    |

---

## Backend Integration

### Node.js / Next.js Example

```js
import crypto from "crypto"

export function generateSignedUrl(key, expiresInSeconds = 300) {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
  const payload = `${key}:${exp}`

  const sig = crypto
    .createHmac("sha256", process.env.SIGNING_SECRET)
    .update(payload)
    .digest("base64")

  return `https://files.example.com?key=${encodeURIComponent(
    key
  )}&exp=${exp}&sig=${encodeURIComponent(sig)}`
}
```

---

## Frontend Usage

### Standard `<img>`

```html
<img src="SIGNED_URL" alt="User avatar" />
```

### Download Link

```html
<a href="SIGNED_URL" target="_blank">Download</a>
```

---

## Next.js Integration

### `next.config.js`

```js
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "files.example.com"
    }
  ]
}
```

### Usage

```jsx
<Image
  src={signedUrl}
  width={200}
  height={200}
  unoptimized
/>
```

> `unoptimized` is recommended because signed URLs expire.

---

## Download vs Image Rendering

The worker automatically determines behavior:

| File Type | Behavior            |
| --------- | ------------------- |
| `image/*` | Render inline       |
| Others    | Download attachment |

No configuration needed.

---

## Security Model
This worker is designed for secure public access to private R2 objects.

- Private R2 bucket (never public)
- HMAC-SHA256 signed URLs
- Enforced expiry timestamps
- Maximum expiry window (15 minutes)
- Timing-safe signature comparison
- Path traversal protection
- No-cache responses
- CORS-safe media access

---

## Expiration & Revocation

* URLs expire by time
* Old links stop working
* New URLs must be generated
* Revocation = wait for expiry

Optional extensions:

* user-bound URLs
* one-time access
* IP-restricted URLs

---

## Common Use Cases

* User avatars
* Private documents
* Medical reports
* Invoices
* Attachments
* Temporary downloads
* Secure image rendering

---

## Performance Considerations

* Served from Cloudflare edge
* No backend bandwidth usage
* No cold starts for R2 access
* Highly scalable

---

## Limitations

* URLs are visible in browser (by design)
* Expiry is time-based only (default)
* Requires backend URL generation
* Does not replace authentication

---

## Extending the Worker

Possible enhancements:

* Bind signature to userId
* JWT validation
* One-time URLs
* Image resizing
* Rate limiting
* Audit logging
* IP restrictions

Designed for easy extension.

---

## Best Practices

* Keep expiry short (1–10 minutes)
* Rotate signing secrets periodically
* Never store signed URLs in DB
* Always store only object keys
* Keep bucket private

---

## FAQ

### Why not backend proxy?

Backend proxy does not scale and increases costs.

### Why not public R2?

Public R2 URLs cannot be revoked or expired.

### Is this secure?

Yes, when used with a private bucket and short expiry.

### Can users share URLs?

Yes, but only until expiry.

---

## License

MIT License
Free for commercial and personal use.

