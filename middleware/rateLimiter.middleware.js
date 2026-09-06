import rateLimit from "express-rate-limit";

// The integration suite drives real HTTP requests through /auth/register
// across many test files in one Jest process (--runInBand); without this,
// the shared per-process counter crosses these limits well before the
// suite finishes and produces unrelated 429s.
const skipInTest = () => process.env.NODE_ENV === "test";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per windowMs (more reasonable for development)
  skip: skipInTest,
  message: "Too many authentication attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many authentication attempts, please try again later",
      timestamp: new Date().toISOString(),
    });
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests, please try again later",
      timestamp: new Date().toISOString(),
    });
  },
});
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // more lenient than authLimiter
  skip: skipInTest,
});

// D17 "write-heavy" group.
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many posts created, please try again later",
      timestamp: new Date().toISOString(),
    });
  },
});

// D17 "upload" group -- distinct from write-heavy (Engineering Standards
// §5.4): covers every endpoint that issues a presigned upload URL.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many upload requests, please try again later",
      timestamp: new Date().toISOString(),
    });
  },
});

export { authLimiter, apiLimiter, refreshLimiter, writeLimiter, uploadLimiter };
