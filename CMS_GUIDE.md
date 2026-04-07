# Fastoosh CMS Setup Guide

## Overview
Your Fastoosh website now has a fully functional CMS (Content Management System) powered by Supabase. You can manage projects, tools, team members, and site-wide settings dynamically without touching the code.

## Quick Start

### 1. Initialize Sample Data
Visit `/init` to populate your database with sample content:
- Sample projects (FinTech Launch, SaaS Onboarding, etc.)
- Sample tools (AE Automation Toolkit, Motion Presets Pro, etc.)
- Sample team members

**URL:** `https://your-site.com/init`

### 2. Access Admin Panel
Visit `/admin` to manage your content:
- Add/edit/delete projects
- Add/edit/delete tools
- Add/edit/delete team members
- Configure site-wide settings (client logos, etc.)

**URL:** `https://your-site.com/admin`

### 3. View Your Content
Your content automatically appears on these pages:
- `/projects` - Browse all projects
- `/tools` - Browse all tools
- `/about` - See team members and "Trusted By" client logos

## Key Features

### Admin Panel (`/admin`)
- **Projects Tab**: Manage project portfolio
  - Title, description, category, year
  - Image and video URLs
  - Tags and featured status
  
- **Tools Tab**: Manage digital products
  - Name, description, category, price
  - Demo and download URLs
  - Feature lists and featured status
  
- **Team Tab**: Manage team members
  - Name, role, bio
  - Profile images
  - Social links

- **Settings Tab**: Site-wide configuration
  - **Client Logos Manager** — powers the "Trusted By" marquee on the About page
    - Add a logo by entering a **Name** and either:
      - Pasting a public **Image URL** directly, or
      - Clicking **Upload** to pick a local file — the file is sent to the `/upload-image` endpoint and the returned public URL is auto-filled
    - A **live preview** of the logo image is shown before saving
    - Each logo can be **deleted** individually
    - Save all changes with the **Save Settings** button

### "Trusted By" Marquee (About Page)
The client logos you configure in the Settings tab power a smooth infinite ticker on the About page:

- **Hidden until configured** — the section (including the heading) is completely hidden while the page is loading and remains hidden if no logos have been saved yet. There are no static placeholder names.
- **Equal spacing** — uses `justify-content: space-around` so the gap between every pair of logos — including the seamless loop point — is mathematically identical.
- **Consistent sizing** — every logo is rendered inside a fixed **120 × 64 px** bounding box with `object-fit: contain`, so square logos and wide/rectangular logos both appear at the same perceived scale without distortion.
- **Auto-repeat** — if fewer than 6 logos are configured, they are automatically repeated within each animation frame so the ticker never looks sparse.
- **Pauses on hover** — the animation freezes when the user hovers over the strip, making it easy to read logos.
- **Edge fade** — a CSS `mask-image` gradient fades the logos in/out at the left and right edges regardless of the background color behind the card.

### Fallback Content
If the API fails or returns no data, the website shows fallback content so your site never breaks. Once you add content via the admin panel, it will override the fallback data.

> **Note:** The "Trusted By" section has **no** fallback logos by design. It only renders when real logos are saved in Settings.

## Database Structure

All content is stored in Supabase using the KV (Key-Value) store:
- `project:{id}` - Project entries
- `tool:{id}` - Tool entries
- `team:{id}` - Team member entries
- `settings:global` - Site-wide settings (includes `clientLogos` array)

### `clientLogos` schema (inside `settings:global`)
```json
{
  "clientLogos": [
    { "name": "Acme Corp", "imageUrl": "https://..." },
    { "name": "Studio X",  "imageUrl": "https://..." }
  ]
}
```
Each entry requires a `name` string and an optional `imageUrl`. If `imageUrl` is omitted the logo name is rendered as styled text in the ticker.

## API Endpoints

The backend provides these endpoints:

### Projects
- `GET /projects` - List all projects
- `GET /projects/:id` - Get single project
- `POST /projects` - Create/update project
- `DELETE /projects/:id` - Delete project

### Tools
- `GET /tools` - List all tools
- `GET /tools/:id` - Get single tool
- `POST /tools` - Create/update tool
- `DELETE /tools/:id` - Delete tool

### Team
- `GET /team` - List all team members
- `POST /team` - Create/update team member
- `DELETE /team/:id` - Delete team member

### Settings
- `GET /settings` - Get site settings (includes `clientLogos`)
- `POST /settings` - Update site settings (replaces entire `clientLogos` array)

### Image Upload
- `POST /upload-image` - Upload a file to Supabase Storage; returns `{ url: "https://..." }`
  - Used by the Client Logos manager's Upload button
  - Accepts `multipart/form-data` with a `file` field
  - Returns a permanent public URL safe to store in `clientLogos[].imageUrl`

## Deployment to Vercel/Netlify

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add CMS functionality"
   git push origin main
   ```

2. **Deploy to Vercel** (Recommended)
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel auto-detects the build settings
   - Deploy!

3. **Deploy to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Import your GitHub repository
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Deploy!

4. **Add Custom Domain**
   - In Vercel/Netlify settings
   - Add your custom domain (fastoosh.com)
   - Update DNS records as instructed

## Important Notes

- **No SQL migrations needed** - The KV store is flexible and ready to use
- **Data persists** in Supabase - Your content is safely stored in the cloud
- **Real-time updates** - Changes in admin panel appear immediately on the site
- **Scalable** - Can handle thousands of projects/tools/team members
- **Free tier** - Supabase free tier is generous for most use cases

## Customization

### Adding New Content Types
To add new content types (e.g., testimonials, blog posts):

1. Add API endpoints in `/supabase/functions/server/index.tsx`
2. Add forms in `/src/app/pages/Admin.tsx`
3. Create pages to display the content
4. Use the same pattern as projects/tools

### Styling the Admin Panel
The admin panel uses your existing glassmorphism design system. You can customize it by editing:
- `/src/app/pages/Admin.tsx`

## Troubleshooting

**Issue: Data not loading**
- Check browser console for errors
- Verify Supabase connection is active
- Try visiting `/init` to seed sample data

**Issue: Can't save content**
- Check network tab for API errors
- Verify required fields are filled
- Check browser console logs

**Issue: Images not displaying**
- Use direct image URLs (Unsplash, Cloudinary, etc.)
- Ensure URLs are publicly accessible
- Check image URL format in admin panel

**Issue: "Trusted By" section not showing on About page**
- The section only renders when at least one logo is saved in **Admin → Settings → Client Logos**
- There are no static placeholder logos — you must add real ones
- After saving, do a hard refresh (`Ctrl+Shift+R`) to clear any cached settings

**Issue: Logo looks too small or distorted in the marquee**
- Every logo slot is 120 × 64 px with `object-fit: contain` — the image will never be cropped
- If the logo appears small, the source image likely has large transparent padding around it; crop the image before uploading

## Next Steps

1. Visit `/init` to seed sample data
2. Visit `/admin` to customize content
3. Update projects with your real work
4. Update tools with your actual products
5. Add your team members
6. **Add client logos** in Admin → Settings → Client Logos
7. Deploy to Vercel/Netlify
8. Add your custom domain
9. Launch! 🚀

---

**Need help?** Check the Supabase docs or Figma Make documentation.