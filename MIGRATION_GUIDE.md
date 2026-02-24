# 🚀 FASTOOSH DATABASE MIGRATION GUIDE

## Overview
This guide will help you migrate from KV store to relational PostgreSQL tables with Lemon Squeezy integration and OAuth authentication.

---

## ✅ STEP 1: Create Database Schema

1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor** (left sidebar)
3. Click **"+ New query"**
4. Copy the entire contents of `/supabase/migrations/schema.sql`
5. Paste it into the SQL editor
6. Click **"Run"** to execute

**✨ This will create:**
- All tables (projects, tools, tool_versions, team_members, user_profiles, user_purchases, site_settings)
- Indexes for performance
- Row Level Security (RLS) policies
- Triggers for auto-updating timestamps
- Sample seed data to test with

---

## ✅ STEP 2: Verify Tables Created

1. In Supabase Dashboard, go to **Table Editor**
2. You should see these tables:
   - ✅ `projects`
   - ✅ `tools`
   - ✅ `tool_versions`
   - ✅ `team_members`
   - ✅ `user_profiles`
   - ✅ `user_purchases`
   - ✅ `site_settings`

3. Click on each table to verify they have data (from seed data)

---

## ✅ STEP 3: Set Up OAuth Authentication

### Google OAuth (Recommended)

1. Go to **Supabase Dashboard → Authentication → Providers**
2. Find **Google** in the list
3. Toggle it **ON**
4. **Follow the setup instructions at:**
   https://supabase.com/docs/guides/auth/social-login/auth-google

**Quick steps:**
- Create a Google Cloud Project
- Enable Google+ API
- Create OAuth 2.0 credentials
- Add authorized redirect URI: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
- Copy Client ID and Client Secret into Supabase

### GitHub OAuth (Alternative)

1. Go to **Supabase Dashboard → Authentication → Providers**
2. Find **GitHub** in the list
3. Toggle it **ON**
4. **Follow:** https://supabase.com/docs/guides/auth/social-login/auth-github

---

## ✅ STEP 4: Create Admin Account

Since you're starting fresh, you need an admin account:

### Option A: Using Supabase Dashboard
1. Go to **Authentication → Users**
2. Click **"Add user"**
3. Choose **"Create new user"**
4. Enter:
   - Email: `youssefdari7@gmail.com` (or your email)
   - Password: (choose a strong password)
   - Auto Confirm User: **✅ YES**
5. Click **"Create user"**

### Option B: Using the signup endpoint
Send a POST request to:
```
POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-e07959ec/signup

Body:
{
  "email": "youssefdari7@gmail.com",
  "password": "your-secure-password",
  "fullName": "Your Name"
}
```

---

## ✅ STEP 5: Set Up Lemon Squeezy

### 5.1 Create Lemon Squeezy Account
1. Go to https://lemonsqueezy.com
2. Sign up for an account
3. Complete store setup

### 5.2 Create Products
For each tool (e.g., GlitchMaster Pro):

1. **Create Product:**
   - Go to **Products → New Product**
   - Name: "GlitchMaster Pro"
   - Description: (your tool description)

2. **Create Variants:**
   - **Free Version:** $0 (or don't create, use direct download)
   - **Pro - Monthly:** $19.99/month
   - **Pro - Yearly:** $149.99/year (save 37%)
   - **Pro - Lifetime:** $299.99 one-time
   - **Studio - Monthly:** $99.99/month
   - **Studio - Yearly:** $799.99/year
   - **Studio - Lifetime:** $1499.99 one-time

3. **Enable License Keys:**
   - In product settings → Enable "License Keys"
   - Set activation limit (e.g., 2 devices for Pro, unlimited for Studio)

4. **Note Down IDs:**
   - Copy the **Product ID** (e.g., `prod_abc123`)
   - Copy each **Variant ID** (e.g., `var_xyz789`)

### 5.3 Update Database with Lemon Squeezy IDs

Run this SQL in Supabase SQL Editor:

```sql
-- Update GlitchMaster Pro - Pro Monthly
UPDATE tool_versions
SET 
  lemon_squeezy_product_id = 'YOUR_PRODUCT_ID',
  lemon_squeezy_variant_id = 'YOUR_VARIANT_ID'
WHERE 
  tool_id = (SELECT id FROM tools WHERE slug = 'glitchmaster-pro')
  AND version_type = 'Pro';

-- Repeat for each tool version...
```

### 5.4 Set Up Webhook

1. In Lemon Squeezy Dashboard → **Settings → Webhooks**
2. Click **"+ New Webhook"**
3. **Webhook URL:**
   ```
   https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-e07959ec/webhooks/lemon-squeezy
   ```
4. **Events to subscribe:**
   - ✅ `order_created`
   - ✅ `subscription_created`
   - ✅ `subscription_updated`
   - ✅ `subscription_cancelled`
   - ✅ `subscription_expired`
5. **Save** and copy the **Signing Secret** (you'll need this later for verification)

---

## ✅ STEP 6: Environment Variables

Make sure these are set in Supabase (they already are):
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `RESEND_API_KEY`

---

## ✅ STEP 7: Test the Setup

### Test 1: Check seed data loaded
Visit your site:
- Projects page should show 5 sample projects
- Tools page should show 3 sample tools
- About page should show 3 team members

### Test 2: Test admin login
1. Go to `/admin`
2. Login with the admin account you created
3. Verify you can see the admin panel

### Test 3: Test CRUD operations
In admin panel:
- Create a new project
- Edit a tool
- Delete a team member
- Verify changes appear on frontend

### Test 4: Test OAuth (after setup)
1. Add a "Sign in with Google" button
2. Click it
3. Verify user is created in `user_profiles` table

---

## 🎯 NEXT STEPS: Frontend Updates

After database is set up, I'll need to update:

1. **Admin Panel** (`/src/app/pages/Admin.tsx`)
   - Update API calls to match new endpoints
   - Handle new data structure (separate tool versions)

2. **Frontend Pages**
   - Projects page: works as-is (same structure)
   - Tools page: update to handle `tool_versions` relationship
   - Update API calls from KV format to SQL format

3. **User Dashboard** (NEW)
   - Create `/dashboard` page
   - Show user's purchased tools
   - Display license keys
   - Download links

4. **Checkout Flow** (NEW)
   - Add "Buy Now" buttons on tool pages
   - Integrate Lemon Squeezy checkout
   - Handle post-purchase redirect

5. **OAuth Login** (NEW)
   - Add social login buttons
   - Handle OAuth callback
   - Store tokens in localStorage

---

## 📊 Data Structure Comparison

### Before (KV Store):
```javascript
{
  id: "tool-1",
  name: "GlitchMaster Pro",
  versions: [
    { type: "Free", price: 0, ... },
    { type: "Pro", monthlyPrice: 19.99, ... }
  ]
}
```

### After (SQL):
```sql
-- tools table
{
  id: uuid,
  name: "GlitchMaster Pro",
  slug: "glitchmaster-pro",
  ...
}

-- tool_versions table (separate)
[
  {
    id: uuid,
    tool_id: uuid (FK),
    version_type: "Free",
    monthly_price: null,
    ...
  },
  {
    id: uuid,
    tool_id: uuid (FK),
    version_type: "Pro",
    monthly_price: 19.99,
    ...
  }
]
```

---

## 🆘 Troubleshooting

### Issue: "relation does not exist"
**Solution:** Run the schema.sql file in Supabase SQL Editor

### Issue: "permission denied for table"
**Solution:** Check RLS policies are enabled, use service role key in backend

### Issue: "duplicate key value"
**Solution:** Check for existing data with same ID/slug

### Issue: OAuth redirect not working
**Solution:** 
- Verify redirect URI in OAuth provider settings
- Check it matches exactly: `https://PROJECT_REF.supabase.co/auth/v1/callback`

### Issue: Webhook not receiving events
**Solution:**
- Check webhook URL is correct
- Verify URL is publicly accessible
- Check Lemon Squeezy webhook logs

---

## ✨ Benefits of New Architecture

✅ **Data Integrity** - Foreign keys prevent orphaned data
✅ **Performance** - Indexed queries, efficient joins
✅ **Scalability** - Handles 1000s of products/users
✅ **Security** - Row Level Security (RLS)
✅ **E-commerce Ready** - Purchases, licenses, subscriptions
✅ **Multi-user** - User accounts with OAuth
✅ **Professional** - Industry-standard relational design

---

**Ready to proceed? Let me know when you've:**
1. ✅ Created the database schema
2. ✅ Set up OAuth provider
3. ✅ Created admin account
4. ✅ Set up Lemon Squeezy products

**Then I'll update the frontend to work with the new backend!** 🚀
