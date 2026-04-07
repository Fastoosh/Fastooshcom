# 🍋 Lemon Squeezy Integration Guide

## Why Lemon Squeezy?

Lemon Squeezy is perfect for digital product sales because it handles:
- ✅ Payment processing (credit cards, PayPal, Apple Pay)
- ✅ **License key generation & management** (built-in!)
- ✅ Subscription billing (monthly/yearly)
- ✅ One-time payments (lifetime licenses)
- ✅ Customer portal (customers manage their own subscriptions)
- ✅ Webhooks (notify your app of purchases)
- ✅ Tax handling (VAT, GST, sales tax)
- ✅ Fraud prevention
- ✅ Invoicing
- ✅ Affiliate program (optional)

**No need to build your own license system!**

---

## Architecture Flow

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Customer  │────────▶│  Lemon Squeezy   │────────▶│  Your Backend   │
│  (Frontend) │  Clicks │   (Checkout)     │ Webhook │  (Supabase)     │
└─────────────┘  "Buy"  └──────────────────┘         └─────────────────┘
                                │                              │
                                │ Payment Success              │
                                │ + License Key                │ Store purchase
                                ▼                              ▼
                         Customer gets:               ┌─────────────────┐
                         - Order confirmation         │  user_purchases │
                         - License key                │     table       │
                         - Download link              └─────────────────┘
```

---

## Setup Steps

### 1. Create Lemon Squeezy Account

1. Go to https://lemonsqueezy.com
2. Sign up (free to start, 5% + payment processor fees on sales)
3. Set up your store:
   - Store name: "Fastoosh"
   - Store URL: `fastoosh.lemonsqueezy.com`
   - Currency: USD

### 2. Create a Product (Example: GlitchMaster Pro)

**In Lemon Squeezy Dashboard:**

1. Click **Products** → **New Product**

2. **Product Details:**
   - Name: `GlitchMaster Pro`
   - Description: Full description of the tool
   - Media: Upload product images/videos
   - Delivery: Choose **"License Keys"** ✅

3. **Create Variants:**
   
   Click **Add Variant** for each pricing option:

   **Variant 1: Pro - Monthly Subscription**
   - Name: `Pro - Monthly`
   - Price: `$19.99`
   - Billing: `Subscription` → `Monthly`
   - Trial: Optional (e.g., 7-day free trial)

   **Variant 2: Pro - Yearly Subscription**
   - Name: `Pro - Yearly`
   - Price: `$149.99` (save 37%!)
   - Billing: `Subscription` → `Yearly`

   **Variant 3: Pro - Lifetime**
   - Name: `Pro - Lifetime`
   - Price: `$299.99`
   - Billing: `One-time payment`

4. **License Key Settings:**
   - Enable **"Generate license keys"** ✅
   - Activation limit: `2` (user can activate on 2 devices)
   - Unlimited activations: ❌ (for Pro)

5. **After-purchase:**
   - Thank you page: Use default or custom
   - Email confirmation: ✅ Enabled

6. **Save Product**

7. **Copy IDs:**
   - Click on the product → Copy **Product ID** (e.g., `185558`)
   - Click on each variant → Copy **Variant ID** (e.g., `205691`)

### 3. Update Database with IDs

In Supabase SQL Editor, run:

```sql
-- Update GlitchMaster Pro - Pro Monthly
UPDATE tool_versions
SET 
  lemon_squeezy_product_id = '185558',  -- Your product ID
  lemon_squeezy_variant_id = '205691'   -- Your variant ID
WHERE 
  tool_id = (SELECT id FROM tools WHERE slug = 'glitchmaster-pro')
  AND version_type = 'Pro'
  AND monthly_price IS NOT NULL
  AND yearly_price IS NULL
  AND lifetime_price IS NULL;

-- Update GlitchMaster Pro - Pro Yearly
UPDATE tool_versions
SET 
  lemon_squeezy_product_id = '185558',
  lemon_squeezy_variant_id = '205692'  -- Different variant ID
WHERE 
  tool_id = (SELECT id FROM tools WHERE slug = 'glitchmaster-pro')
  AND version_type = 'Pro'
  AND yearly_price IS NOT NULL;

-- Update GlitchMaster Pro - Pro Lifetime
UPDATE tool_versions
SET 
  lemon_squeezy_product_id = '185558',
  lemon_squeezy_variant_id = '205693'
WHERE 
  tool_id = (SELECT id FROM tools WHERE slug = 'glitchmaster-pro')
  AND version_type = 'Pro'
  AND lifetime_price IS NOT NULL;
```

---

## Frontend Integration

### Adding "Buy Now" Button

```tsx
import { useState } from 'react';

function ToolPurchaseButton({ variantId, price, type }: { 
  variantId: string;
  price: number;
  type: 'monthly' | 'yearly' | 'lifetime';
}) {
  const handlePurchase = () => {
    // Lemon Squeezy checkout URL
    const checkoutUrl = `https://fastoosh.lemonsqueezy.com/checkout/buy/${variantId}?checkout[email]=${userEmail}&checkout[custom][user_id]=${userId}`;
    
    // Open checkout in popup or redirect
    window.open(checkoutUrl, '_blank');
    
    // OR redirect:
    // window.location.href = checkoutUrl;
  };

  return (
    <button onClick={handlePurchase} className="btn-primary">
      Buy {type === 'monthly' ? 'Monthly' : type === 'yearly' ? 'Yearly' : 'Lifetime'}
      <span>${price}{type !== 'lifetime' && '/mo'}</span>
    </button>
  );
}
```

### After Purchase Flow

1. **User clicks "Buy Now"**
2. **Lemon Squeezy opens checkout page** (secure, PCI-compliant)
3. **User completes payment**
4. **Lemon Squeezy sends webhook** to your backend
5. **Your backend creates record** in `user_purchases` table
6. **User redirected back** to your site
7. **User sees license key** in their dashboard

---

## Webhook Handler (Already in Backend!)

The backend already has this endpoint:

```
POST /make-server-e07959ec/webhooks/lemon-squeezy
```

**What it does:**
1. Receives purchase notification from Lemon Squeezy
2. Extracts order data (customer email, license key, product, price)
3. Finds user by email
4. Creates record in `user_purchases` table
5. User can now see their purchase in dashboard

**Events handled:**
- ✅ `order_created` - New purchase
- ✅ `subscription_created` - New subscription
- ✅ `subscription_updated` - Subscription changed
- ✅ `subscription_cancelled` - User cancelled
- ✅ `subscription_expired` - Subscription ended

---

## Webhook Setup

1. In Lemon Squeezy: **Settings** → **Webhooks**
2. Click **"Create Webhook"**
3. **Webhook URL:**
   ```
   https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-e07959ec/webhooks/lemon-squeezy
   ```
   Replace `YOUR_PROJECT_ID` with your Supabase project ID

4. **Subscribe to events:**
   - ✅ `order_created`
   - ✅ `subscription_created`
   - ✅ `subscription_updated`
   - ✅ `subscription_cancelled`
   - ✅ `subscription_expired`

5. **Signing secret:** Copy it (optional, for verifying webhook authenticity)

6. **Save**

7. **Test it:**
   - Click "Send test webhook"
   - Check Supabase logs to see if received

---

## Testing Purchases

### Test Mode (Sandbox)

Lemon Squeezy has a test mode:

1. In Dashboard: Toggle **Test Mode** ON
2. Use test card: `4242 4242 4242 4242`
3. Any future expiry date
4. Any CVV

Test purchases won't charge real money and appear with a "TEST" badge.

---

## License Key Verification

Your backend already has this endpoint:

```
POST /make-server-e07959ec/verify-license
Body: { "licenseKey": "ABC123-DEF456-GHI789" }
```

**Use case:** 
When user downloads your tool, the tool can verify the license key by calling this endpoint.

**Response if valid:**
```json
{
  "success": true,
  "valid": true,
  "data": {
    "product_name": "GlitchMaster Pro",
    "variant_name": "Pro - Monthly",
    "expires_at": "2026-03-23T00:00:00Z"
  }
}
```

---

## Pricing Recommendations

Based on motion design tools market:

### GlitchMaster Pro
- 🆓 **Free:** $0 (10 presets, basic features)
- 💼 **Pro Monthly:** $19.99/mo (100+ presets, all features)
- 💼 **Pro Yearly:** $149.99/yr (save 37%, best value)
- 💎 **Pro Lifetime:** $299.99 one-time (no recurring fees)
- 🏢 **Studio Monthly:** $99.99/mo (teams, white-label)
- 🏢 **Studio Yearly:** $799.99/yr
- 🏢 **Studio Lifetime:** $1499.99

### Neon Flow
- 🆓 **Free:** $0
- 💼 **Pro Monthly:** $14.99/mo
- 💼 **Pro Yearly:** $99.99/yr (save 44%)
- 💎 **Pro Lifetime:** $199.99

### TypeFlow Studio
- 🆓 **Free:** $0
- 💼 **Pro Monthly:** $14.99/mo
- 💼 **Pro Yearly:** $99.99/yr
- 💎 **Pro Lifetime:** $199.99

**Pro tip:** Yearly pricing at ~60-70% of monthly annual cost drives conversions!

---

## User Dashboard (To Build)

Create a page at `/dashboard` that shows:

```tsx
function UserDashboard() {
  const [purchases, setPurchases] = useState([]);

  useEffect(() => {
    // Fetch user's purchases
    fetch('/api/user/purchases', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
      .then(res => res.json())
      .then(data => setPurchases(data.data));
  }, []);

  return (
    <div>
      <h1>My Purchases</h1>
      {purchases.map(purchase => (
        <div key={purchase.id} className="purchase-card">
          <h3>{purchase.product_name}</h3>
          <p>Plan: {purchase.variant_name}</p>
          <p>License Key: <code>{purchase.license_key}</code></p>
          <p>Status: {purchase.status}</p>
          {purchase.expires_at && (
            <p>Expires: {new Date(purchase.expires_at).toLocaleDateString()}</p>
          )}
          <button>Download Tool</button>
          <button>Manage Subscription</button>
        </div>
      ))}
    </div>
  );
}
```

---

## Customer Portal

Lemon Squeezy provides a built-in customer portal where users can:
- View their purchases
- Download license keys
- Manage subscriptions (pause, resume, cancel)
- Update payment methods
- View invoices

**Link to customer portal:**
```
https://app.lemonsqueezy.com/my-orders
```

Or get a custom URL for specific customer via API.

---

## Revenue & Analytics

Lemon Squeezy Dashboard shows:
- 💰 Total revenue
- 📊 Sales charts
- 🔄 MRR (Monthly Recurring Revenue)
- 📈 Growth metrics
- 🧑‍🤝‍🧑 Customer analytics
- 💳 Refund rates
- 🌍 Geographic data

---

## Fees

**Lemon Squeezy charges:**
- 5% + payment processor fees
- Payment processor: ~2.9% + $0.30 per transaction

**Example:**
- Sale: $19.99
- Lemon Squeezy (5%): $1.00
- Stripe fee (2.9% + $0.30): $0.88
- **You receive: $18.11** (90.6%)

**Higher tier plans available** with lower fees if you're doing $10k+/month.

---

## Next Steps

1. ✅ Create Lemon Squeezy account
2. ✅ Set up products and variants
3. ✅ Configure webhook
4. ✅ Update database with product/variant IDs
5. ✅ Add "Buy Now" buttons to tool pages
6. ✅ Build user dashboard page
7. ✅ Test with test mode purchases
8. ✅ Go live! 🚀

---

**Questions? Let me know!** I can help with:
- Setting up the checkout buttons
- Building the user dashboard
- Customizing the post-purchase flow
- Handling edge cases (refunds, upgrades, etc.)
