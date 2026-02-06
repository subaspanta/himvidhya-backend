# CSRF Protection in olo Server

## Current Approach (Recommended for 2026)

Your server uses **SameSite cookies + Helmet headers**, which is the modern standard for CSRF protection.

### ✅ How It Works

```
Frontend Request → Server validates SameSite cookie
                  ↓
                  Browser only sends cookie if:
                  - Same-origin request (SameSite: Strict)
                  - Top-level navigation (SameSite: Lax)
                  ↓
                  Cross-site requests rejected by browser
```

### Why We Don't Need CSRF Tokens

1. **SameSite: Strict** configured on all auth cookies
   - Browsers block cookies on cross-site requests
   - Prevents CSRF attacks at the browser level

2. **Helmet security headers** enforce additional protections
   - X-Frame-Options: DENY (prevents clickjacking)
   - X-Content-Type-Options: nosniff (prevents MIME-sniffing)

3. **No archived dependencies**
   - CSURF is archived and won't receive security patches
   - SameSite is built into modern browsers (97%+ support)

### Current Configuration

**In auth.controller.js:**

```javascript
res.cookie("token", token, {
  httpOnly: true, // ✅ Prevents JavaScript access
  secure: process.env.NODE_ENV === "production", // ✅ HTTPS only
  sameSite: "strict", // ✅ No cross-site cookies
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

**In server.js:**

```javascript
app.use(helmet()); // ✅ Security headers
app.use(
  cors({
    // ✅ CORS validation
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);
```

## Browser Support

| Browser | SameSite Support | Released |
| ------- | ---------------- | -------- |
| Chrome  | ✅ Yes (v51+)    | 2016     |
| Firefox | ✅ Yes (v60+)    | 2018     |
| Safari  | ✅ Yes (v13.1+)  | 2020     |
| Edge    | ✅ Yes           | 2020     |
| IE 11   | ❌ No            | EOL 2022 |

**Market coverage: 97%+ of users** ✅

## SameSite Cookie Modes

| Mode       | CSRF Protection | Cross-Site Navigation | Use Case           |
| ---------- | --------------- | --------------------- | ------------------ |
| **Strict** | ✅ Maximum      | ❌ Blocked            | Auth tokens        |
| **Lax**    | ✅ Good         | ✅ Allowed            | Session cookies    |
| **None**   | ❌ None         | ✅ Allowed            | Third-party embeds |

**Your config: SameSite: Strict** → Maximum protection for sensitive tokens

## When to Use Token-Based CSRF

You might consider CSRF tokens if:

- Supporting IE 11 or older browsers
- Need to allow token submission from any origin
- Building a public API for third-party integrations

## Modern CSRF Token Alternatives

If you need token-based CSRF in the future, here are modern maintained packages:

### 1. **csrf-csrf** (Recommended)

```bash
npm install csrf-csrf
```

```javascript
const { doubleCsrf } = require("csrf-csrf");

const { generateToken, validateToken } = doubleCsrf({
  getSecret: () => "your-secret",
});

// Generate on GET requests
app.get("/form", (req, res) => {
  res.json({ token: generateToken(req, res) });
});

// Validate on POST requests
app.post("/form", validateToken, (req, res) => {
  // Handle form
});
```

### 2. **double-csrf**

```bash
npm install double-csrf
```

- Double-submit cookie pattern
- No server-side storage
- Lightweight and modern

### 3. **express-session** + **csurf** alternatives

For session-based apps:

```bash
npm install express-session
```

## Security Checklist ✅

- ✅ **httpOnly cookies** - Prevents XSS access
- ✅ **Secure flag** - HTTPS only in production
- ✅ **SameSite: Strict** - Prevents CSRF
- ✅ **Helmet headers** - Additional protections
- ✅ **CORS configured** - Validates origins
- ✅ **Rate limiting** - Prevents brute force
- ✅ **Input validation** - Via Zod
- ✅ **Password hashing** - Via bcryptjs

## Attack Scenarios Prevented

### 1. Cross-Site Request Forgery (CSRF)

```
Attacker's site → Sends request to your API
                  ↓
                  Browser blocks cookie (SameSite: Strict)
                  ↓
                  Request fails ✅
```

### 2. Cookie Theft via XSS

```
XSS injection → JavaScript tries to access cookie
               ↓
               Blocked by httpOnly flag ✅
```

### 3. Man-in-the-Middle (MITM)

```
Attacker intercepts HTTP
↓
Secure flag enforces HTTPS ✅
```

### 4. Clickjacking

```
Attacker embeds your site in iframe
↓
X-Frame-Options: DENY blocks it ✅
```

## Testing CSRF Protection

### Test 1: SameSite Prevention

```bash
# This should fail (cross-site cookie):
curl -X POST https://attacker.com/attack \
  -b "token=valid_token_from_your_app"

# Browser won't send the cookie due to SameSite: Strict
```

### Test 2: Helmet Headers

```bash
curl -I https://your-api.com/health

# Should see:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Strict-Transport-Security: max-age=15552000
```

## Deployment Checklist

- [ ] Set `NODE_ENV=production` in production
- [ ] Set `SECURE_COOKIES=true` for HTTPS
- [ ] Add `FRONTEND_URL` to environment
- [ ] Use HTTPS/TLS certificates
- [ ] Monitor CORS and rate limit logs
- [ ] Regular security audits

## References

- **SameSite Cookies**: https://owasp.org/www-community/attacks/csrf
- **Helmet.js**: https://helmetjs.github.io/
- **OWASP CSRF Prevention**: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

## FAQ

**Q: Is SameSite enough for CSRF?**
A: Yes, for modern browsers (97%+ coverage). For legacy support, add CSRF tokens.

**Q: Do I need the /csrf-token endpoint?**
A: No, SameSite cookies handle it. Only needed if implementing token-based CSRF.

**Q: Why not use csurf anymore?**
A: It's archived and unmaintained. SameSite is built-in and more secure.

**Q: What if my frontend needs to handle CSRF?**
A: It doesn't! SameSite is handled at the browser level, transparent to your frontend.
