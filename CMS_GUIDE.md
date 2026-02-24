# Fastoosh CMS Setup Guide

## Overview
Your Fastoosh website now has a fully functional CMS (Content Management System) powered by Supabase. You can manage projects, tools, and team members dynamically without touching the code.

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

**URL:** `https://your-site.com/admin`

### 3. View Your Content
Your content automatically appears on these pages:
- `/projects` - Browse all projects
- `/tools` - Browse all tools
- `/about` - See team members (if integrated)

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

### Fallback Content
If the API fails or returns no data, the website shows fallback content so your site never breaks. Once you add content via the admin panel, it will override the fallback data.

## Database Structure

All content is stored in Supabase using the KV (Key-Value) store:
- `project:{id}` - Project entries
- `tool:{id}` - Tool entries
- `team:{id}` - Team member entries
- `settings:global` - Site-wide settings

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
- `GET /settings` - Get site settings
- `POST /settings` - Update site settings

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

## Next Steps

1. Visit `/init` to seed sample data
2. Visit `/admin` to customize content
3. Update projects with your real work
4. Update tools with your actual products
5. Add your team members
6. Deploy to Vercel/Netlify
7. Add your custom domain
8. Launch! 🚀

---

**Need help?** Check the Supabase docs or Figma Make documentation.
