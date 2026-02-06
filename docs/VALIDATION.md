# Validation in olo Server

## Overview

Your server uses **Zod** for centralized input validation. Zod is a TypeScript-first schema validation library with excellent error handling and composability.

## Why Zod?

✅ **Best for your stack:**

- Works perfectly with CommonJS (no TypeScript required)
- Excellent error messages with field-level details
- Type-safe schemas (optional TypeScript support)
- Lightweight but powerful
- Great community support

## Architecture

```
Request → Validation Middleware (Zod) → Controller → Service → Database
           ↓
        Invalid → 400 Bad Request (structured errors)
```

### Three-Layer Validation Approach

1. **Schema Layer** (`schemas/validationSchemas.js`)
   - Define Zod schemas for each endpoint
   - Reusable validation rules
   - Centralized schema management

2. **Middleware Layer** (`middleware/validateRequest.js`)
   - Generic validation middleware
   - Catches validation errors
   - Returns structured error responses

3. **Route Layer** (`routes/publicRoutes.js`)
   - Apply validation middleware to endpoints
   - `router.post("/route", validate(schema), controller)`

## Current Validation Schemas

### 1. **Registration** (`registerSchema`)

```javascript
{
  name: string (2-50 chars)
  email: string (valid email, max 100 chars)
  username: string (3-20 chars, alphanumeric with _ or -, optional)
  password: string (8+ chars, 1 uppercase, 1 number, 1 symbol)
}
```

### 2. **Login** (`loginSchema`)

```javascript
{
  email: string (valid email, max 100 chars)
  password: string (required)
}
```

### 3. **Forget Password** (`forgetPasswordSchema`)

```javascript
{
  email: string (valid email, max 100 chars)
}
```

### 4. **Reset Password** (`resetPasswordSchema`)

```javascript
{
  password: string (8+ chars, 1 uppercase, 1 number, 1 symbol)
}
```

## Example Error Response

**Request:**

```json
POST /api/public/register
{
  "name": "A",
  "email": "invalid-email",
  "password": "weak"
}
```

**Response (400):**

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "name",
      "message": "String must contain at least 2 character(s)"
    },
    {
      "field": "email",
      "message": "Invalid email"
    },
    {
      "field": "password",
      "message": "String must contain at least 8 character(s)"
    }
  ]
}
```

## Adding New Validation Rules

### Example: Add validation for new endpoint

**1. Define schema** (`schemas/validationSchemas.js`):

```javascript
const updateProfileSchema = z.object({
  name: z.string().min(2).max(50),
  avatar: z.string().url().optional(),
  bio: z.string().max(200).optional(),
});

module.exports = {
  // ... existing schemas
  updateProfileSchema,
};
```

**2. Use in route** (`routes/protectedRoutes.js`):

```javascript
const validate = require("../middleware/validateRequest.js");
const { updateProfileSchema } = require("../schemas/validationSchemas.js");

router.post(
  "/users/profile",
  protect,
  validate(updateProfileSchema),
  updateProfile,
);
```

**3. Controller handles validated data:**

```javascript
const updateProfile = async (req, res, next) => {
  // req.body is already validated and type-checked
  const { name, avatar, bio } = req.body;
  // ... rest of logic
};
```

## Common Zod Methods

| Method            | Description          | Example                    |
| ----------------- | -------------------- | -------------------------- |
| `z.string()`      | String validation    | `z.string().min(3)`        |
| `z.number()`      | Number validation    | `z.number().positive()`    |
| `z.boolean()`     | Boolean validation   | `z.boolean()`              |
| `z.email()`       | Email validation     | `z.string().email()`       |
| `z.url()`         | URL validation       | `z.string().url()`         |
| `.min(n)`         | Minimum length/value | `z.string().min(5)`        |
| `.max(n)`         | Maximum length/value | `z.string().max(100)`      |
| `.regex(pattern)` | Pattern matching     | `.regex(/^[A-Za-z]+$/)`    |
| `.optional()`     | Optional field       | `z.string().optional()`    |
| `.or()`           | Alternative value    | `.or(z.literal(""))`       |
| `.trim()`         | Trim whitespace      | `z.string().trim()`        |
| `.toLowerCase()`  | Convert to lowercase | `z.string().toLowerCase()` |

## Comparison with Other Options

| Feature            | Zod          | Joi          | Express-validator | Yup          |
| ------------------ | ------------ | ------------ | ----------------- | ------------ |
| Size               | 35KB         | 65KB         | 30KB              | 20KB         |
| API                | ⭐⭐⭐ Clean | ⭐⭐ Verbose | ⭐⭐⭐ Good       | ⭐⭐⭐ Clean |
| Error Messages     | Excellent    | Good         | Good              | Good         |
| Learning Curve     | Easy         | Medium       | Easy              | Easy         |
| TypeScript Support | Built-in     | Separate     | Separate          | Separate     |
| Async Validation   | ✅           | ✅           | ✅                | ✅           |

**Why Zod was chosen:**

- Clean, intuitive API
- Excellent error messages
- Best documentation
- Works great with CommonJS and optional TypeScript

## Best Practices

1. **Centralize schemas** in `schemas/validationSchemas.js`
2. **Reuse schemas** - Don't duplicate validation logic
3. **Use descriptive error messages** - Help clients understand requirements
4. **Validate early** - Use middleware at route level
5. **Type checking** - Leverage Zod's `.parse()` method
6. **Async validation** - Use `.refine()` for database checks

## Future Enhancements

### Custom Validations

```javascript
const registerSchema = z.object({
  email: emailSchema,
  username: z
    .string()
    .min(3)
    .refine(
      async (username) => {
        const exists = await User.findOne({ username });
        return !exists;
      },
      { message: "Username already taken" },
    ),
});
```

### Conditional Validation

```javascript
const profileSchema = z
  .object({
    name: z.string(),
    email: z.string().email().optional(),
  })
  .refine((data) => data.name || data.email, {
    message: "Either name or email must be provided",
  });
```

## Resources

- **Zod Documentation:** https://zod.dev
- **Zod Error Handling:** https://zod.dev?id=error-handling
- **Zod + Express Guide:** https://zod.dev?id=express-middleware
