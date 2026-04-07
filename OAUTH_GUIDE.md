# 🔐 OAuth Authentication Guide (Supabase)

## Why OAuth?

OAuth (via Google, GitHub, etc.) provides:
- ✅ **No password management** - Let Google/GitHub handle it
- ✅ **Faster signups** - One click to create account
- ✅ **Better security** - No passwords to leak
- ✅ **Trusted** - Users trust Google/GitHub
- ✅ **Profile data** - Auto-fill name, email, avatar
- ✅ **Easy implementation** - Supabase handles everything

---

## Supported Providers (Supabase)

- 🔵 **Google** (Recommended - most widely used)
- ⚫ **GitHub** (Great for developer tools)
- 🔷 **Discord**
- 🐦 **Twitter / X**
- 💼 **LinkedIn**
- 📘 **Facebook**
- 🍎 **Apple**
- Many more...

**Recommendation for Fastoosh:** Start with **Google** + **GitHub**

---

## Architecture Flow

```
┌──────────────┐           ┌──────────────────┐           ┌─────────────────┐
│   Customer   │──clicks──▶│  "Login with     │──────────▶│  Google OAuth   │
│  (Frontend)  │  button   │   Google"        │  redirect │   (consent)     │
└──────────────┘           └──────────────────┘           └─────────────────┘
                                                                    │
                                                                    │ User approves
                                                                    ▼
                           ┌──────────────────┐           ┌─────────────────┐
                           │  Your Frontend   │◀──────────│  Supabase Auth  │
                           │  (user logged    │  callback │  (creates user) │
                           │   in!)           │           └─────────────────┘
                           └──────────────────┘                    │
                                    │                              │
                                    │                              ▼
                                    │                    ┌─────────────────┐
                                    └───────────────────▶│ user_profiles   │
                                      Auto-created       │     table       │
                                                         └─────────────────┘
```

---

## Setup Guide: Google OAuth

### Step 1: Get Google OAuth Credentials

1. Go to **Google Cloud Console**: https://console.cloud.google.com
2. Create a new project (or select existing):
   - Name: `Fastoosh`
   - Click **"Create"**

3. **Enable Google+ API:**
   - Click **"APIs & Services"** → **"Library"**
   - Search for **"Google+ API"**
   - Click **"Enable"**

4. **Create OAuth Credentials:**
   - Go to **"APIs & Services"** → **"Credentials"**
   - Click **"+ Create Credentials"** → **"OAuth 2.0 Client IDs"**
   - Application type: **Web application**
   - Name: `Fastoosh Web App`

5. **Add Authorized Redirect URIs:**
   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```
   
   **Example:**
   ```
   https://abcdefghijk.supabase.co/auth/v1/callback
   ```
   
   **Find your Project Ref:**
   - Go to Supabase Dashboard → Settings → API
   - Look at URL or Project URL

6. **Save** and copy:
   - ✅ **Client ID** (e.g., `123456.apps.googleusercontent.com`)
   - ✅ **Client Secret** (e.g., `GOCSPX-abc123...`)

### Step 2: Configure Supabase

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Find **Google** in the list
3. Toggle it **ON** (enable)
4. Paste your credentials:
   - **Client ID:** (from Google Cloud Console)
   - **Client Secret:** (from Google Cloud Console)
5. **Save**

✅ Done! Google OAuth is now enabled.

---

## Setup Guide: GitHub OAuth

### Step 1: Create GitHub OAuth App

1. Go to **GitHub** → Settings → Developer settings
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in:
   - **Application name:** `Fastoosh`
   - **Homepage URL:** `https://fastoosh.com` (your domain)
   - **Authorization callback URL:**
     ```
     https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
     ```

4. Click **"Register application"**

5. Copy:
   - ✅ **Client ID**
   - ✅ **Client Secret** (click "Generate a new client secret")

### Step 2: Configure Supabase

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Find **GitHub** in the list
3. Toggle it **ON**
4. Paste your credentials
5. **Save**

✅ GitHub OAuth ready!

---

## Frontend Implementation

### Install Supabase Client (if not already)

```bash
npm install @supabase/supabase-js
```

### Create Supabase Client

```tsx
// /src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://YOUR_PROJECT_REF.supabase.co';
const supabaseAnonKey = 'YOUR_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Login Component

```tsx
// /src/app/components/LoginModal.tsx
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export function LoginModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading('google');
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error('Google login error:', error);
      alert('Login failed. Please try again.');
      setLoading(null);
    }
    // User will be redirected to Google
  };

  const handleGitHubLogin = async () => {
    setLoading('github');
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error('GitHub login error:', error);
      alert('Login failed. Please try again.');
      setLoading(null);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Sign in to Fastoosh</h2>
        <p>Access your purchased tools and manage your licenses</p>

        <button 
          onClick={handleGoogleLogin}
          disabled={loading !== null}
          className="btn-google"
        >
          {loading === 'google' ? (
            'Redirecting...'
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </button>

        <button 
          onClick={handleGitHubLogin}
          disabled={loading !== null}
          className="btn-github"
        >
          {loading === 'github' ? (
            'Redirecting...'
          ) : (
            <>
              <GitHubIcon />
              Continue with GitHub
            </>
          )}
        </button>

        <button onClick={onClose} className="btn-close">
          Cancel
        </button>
      </div>
    </div>
  );
}
```

### Auth Callback Page

Create `/src/app/pages/AuthCallback.tsx`:

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '@/lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase will automatically handle the OAuth callback
    // and exchange the code for a session
    
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        console.log('User signed in:', session.user);
        
        // Store tokens in localStorage (optional, Supabase does this automatically)
        localStorage.setItem('access_token', session.access_token);
        
        // Redirect to dashboard
        navigate('/dashboard');
      }
    });
  }, [navigate]);

  return (
    <div className="loading-screen">
      <div className="spinner" />
      <p>Completing sign in...</p>
    </div>
  );
}
```

### Add to Routes

```tsx
// /src/app/routes.ts
import { createBrowserRouter } from "react-router";
import { AuthCallback } from "./pages/AuthCallback";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "auth/callback", Component: AuthCallback }, // Add this
      { path: "dashboard", Component: Dashboard },
      // ... other routes
    ],
  },
]);
```

---

## Session Management

### Check if User is Logged In

```tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div>
      {user ? (
        <UserMenu user={user} />
      ) : (
        <button onClick={() => setShowLoginModal(true)}>
          Sign In
        </button>
      )}
    </div>
  );
}
```

### Sign Out

```tsx
const handleSignOut = async () => {
  await supabase.auth.signOut();
  // User state will update automatically via onAuthStateChange
};
```

---

## User Profile Auto-Creation

Your database schema already has a trigger that auto-creates a user profile!

**When user signs in with OAuth:**
1. Supabase creates user in `auth.users` table
2. Trigger fires → Creates record in `user_profiles` table
3. Profile includes:
   - `id` (same as auth.users.id)
   - `email` (from OAuth provider)
   - `full_name` (from OAuth provider)
   - `avatar_url` (from OAuth provider)

**No extra code needed!** ✨

---

## Protected Routes

```tsx
// /src/app/components/ProtectedRoute.tsx
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { supabase } from '@/lib/supabase';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

**Usage:**
```tsx
{
  path: "dashboard",
  element: (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  )
}
```

---

## Backend: Getting User from Token

Your backend already handles this in `requireAuth` middleware:

```typescript
const requireAuth = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader.split(' ')[1];
  
  // Verify token with Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  c.set('user', user);
  await next();
};
```

**Frontend: Make authenticated requests:**
```typescript
const { data: { session } } = await supabase.auth.getSession();

fetch('/api/user/purchases', {
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
});
```

---

## Styling Login Buttons

```css
/* Google Button */
.btn-google {
  background: white;
  color: #1f1f1f;
  border: 1px solid #dadce0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-google:hover {
  background: #f8f9fa;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* GitHub Button */
.btn-github {
  background: #24292e;
  color: white;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-github:hover {
  background: #2f363d;
}
```

---

## Testing OAuth

### Test Flow:
1. Click "Sign in with Google"
2. Redirected to Google consent screen
3. Select your Google account
4. Google redirects back to your site: `/auth/callback`
5. Callback page processes the session
6. Redirected to `/dashboard`
7. You're logged in! ✅

### Debug Issues:

**Issue: "redirect_uri_mismatch"**
- ❌ Wrong: `http://localhost:3000/auth/callback`
- ✅ Correct: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
- The redirect URI must be your **Supabase project URL**, not your app URL

**Issue: "invalid_client"**
- Double-check Client ID and Secret in Supabase Dashboard
- Make sure you copied them correctly from Google Cloud Console

**Issue: User created but profile not created**
- Check if trigger is enabled in Supabase
- Run this SQL to check:
  ```sql
  SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
  ```

---

## User Flow Example

### First-time user:
1. User visits Fastoosh.com
2. Clicks "Buy Now" on a tool
3. Sees: "Sign in to continue"
4. Clicks "Continue with Google"
5. Google consent screen
6. Approved → Account created automatically
7. Redirected to checkout
8. Completes purchase
9. Redirected to dashboard with license key

### Returning user:
1. Visits Fastoosh.com
2. Clicks "Dashboard" or user avatar
3. Already logged in (session persists)
4. Sees all their purchases

---

## Security Best Practices

✅ **Always use HTTPS** - OAuth requires secure connections
✅ **Store tokens securely** - Supabase handles this automatically
✅ **Don't expose service role key** - Only use in backend
✅ **Validate tokens server-side** - Never trust client-side tokens
✅ **Use short session expiry** - Default is 1 hour, refresh token lasts 7 days
✅ **Implement PKCE** - Supabase does this by default

---

## Session Persistence

Supabase automatically:
- ✅ Stores session in localStorage
- ✅ Refreshes expired tokens
- ✅ Handles session expiry gracefully

**Session lifespan:**
- Access token: 1 hour (auto-refreshed)
- Refresh token: 7 days (configurable)

---

## Optional: Email/Password Fallback

If you want to also offer email/password signup (in addition to OAuth):

```tsx
const handleEmailSignup = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    console.error('Signup error:', error);
    return;
  }

  alert('Check your email to confirm your account!');
};
```

**Note:** Requires email confirmation by default (good for security)

---

## Next Steps

1. ✅ Set up Google OAuth (or GitHub)
2. ✅ Add login buttons to your site
3. ✅ Create auth callback page
4. ✅ Test the flow
5. ✅ Build dashboard page
6. ✅ Add protected routes
7. ✅ Link to Lemon Squeezy checkout

---

**Ready to implement?** Let me know if you need help with:
- Creating the login modal UI
- Setting up the auth callback
- Building the user dashboard
- Handling edge cases

🚀 **OAuth + Lemon Squeezy = Perfect E-commerce Stack!**
