-- =====================================================
-- FASTOOSH DATABASE SCHEMA
-- =====================================================
-- Run this in Supabase SQL Editor to create all tables
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== CONTENT TABLES ==========

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT,
  year INTEGER,
  image_url TEXT,
  video_url TEXT,
  tags TEXT[],
  featured BOOLEAN DEFAULT false,
  client TEXT,
  goal TEXT,
  approach TEXT,
  deliverables TEXT[],
  outcome TEXT,
  screenshots TEXT[],
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tools
CREATE TABLE tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  category TEXT,
  image_url TEXT,
  demo_video_url TEXT,
  featured BOOLEAN DEFAULT false,
  faqs JSONB DEFAULT '[]',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tool Versions (Free/Pro/Studio)
CREATE TABLE tool_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
  version_type TEXT NOT NULL CHECK (version_type IN ('Free', 'Pro', 'Studio')),
  tagline TEXT,
  features TEXT[],
  whats_included TEXT[],
  how_it_works JSONB,
  system_requirements TEXT,
  demo_url TEXT,
  
  -- Lemon Squeezy Integration
  lemon_squeezy_product_id TEXT, -- For paid versions
  lemon_squeezy_variant_id TEXT, -- Specific variant (monthly/yearly/lifetime)
  
  -- Pricing (display only, actual prices come from Lemon Squeezy)
  monthly_price DECIMAL(10,2),
  yearly_price DECIMAL(10,2),
  lifetime_price DECIMAL(10,2),
  
  -- Free version download
  download_url TEXT, -- For free versions, direct download
  
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role TEXT,
  bio TEXT,
  image_url TEXT,
  social_links JSONB DEFAULT '{}',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== USER TABLES ==========

-- User Profiles (extends auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  company TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Purchases (synced from Lemon Squeezy webhooks)
CREATE TABLE user_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_version_id UUID REFERENCES tool_versions(id),
  
  -- Lemon Squeezy Data
  lemon_squeezy_order_id TEXT UNIQUE NOT NULL,
  lemon_squeezy_customer_id TEXT,
  lemon_squeezy_subscription_id TEXT, -- NULL for one-time purchases
  license_key TEXT, -- From Lemon Squeezy
  
  -- Purchase Info
  product_name TEXT,
  variant_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled', 'refunded')),
  
  -- Pricing
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  
  -- Dates
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- NULL for lifetime
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== SETTINGS ==========

CREATE TABLE site_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== INDEXES FOR PERFORMANCE ==========

-- Projects
CREATE INDEX idx_projects_category ON projects(category);
CREATE INDEX idx_projects_featured ON projects(featured);
CREATE INDEX idx_projects_year ON projects(year);
CREATE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_projects_order ON projects(order_index);

-- Tools
CREATE INDEX idx_tools_category ON tools(category);
CREATE INDEX idx_tools_featured ON tools(featured);
CREATE INDEX idx_tools_slug ON tools(slug);
CREATE INDEX idx_tools_order ON tools(order_index);

-- Tool Versions
CREATE INDEX idx_tool_versions_tool_id ON tool_versions(tool_id);
CREATE INDEX idx_tool_versions_ls_product ON tool_versions(lemon_squeezy_product_id);

-- Team Members
CREATE INDEX idx_team_members_order ON team_members(order_index);

-- User Purchases
CREATE INDEX idx_purchases_user ON user_purchases(user_id);
CREATE INDEX idx_purchases_status ON user_purchases(status);
CREATE INDEX idx_purchases_ls_order ON user_purchases(lemon_squeezy_order_id);
CREATE INDEX idx_purchases_license_key ON user_purchases(license_key);

-- ========== ROW LEVEL SECURITY (RLS) ==========

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Public read access for content
CREATE POLICY "Anyone can view projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Anyone can view tools" ON tools FOR SELECT USING (true);
CREATE POLICY "Anyone can view tool versions" ON tool_versions FOR SELECT USING (true);
CREATE POLICY "Anyone can view team members" ON team_members FOR SELECT USING (true);
CREATE POLICY "Anyone can view site settings" ON site_settings FOR SELECT USING (true);

-- Admin write access (service role bypasses RLS, so this is for additional app-level users)
-- You'll manage admin access via service role key in backend

-- User profiles
CREATE POLICY "Users can view own profile" ON user_profiles 
  FOR SELECT USING (auth.uid() = id);
  
CREATE POLICY "Users can update own profile" ON user_profiles 
  FOR UPDATE USING (auth.uid() = id);

-- User purchases
CREATE POLICY "Users can view own purchases" ON user_purchases 
  FOR SELECT USING (auth.uid() = user_id);

-- ========== FUNCTIONS ==========

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to all tables
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tools_updated_at BEFORE UPDATE ON tools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tool_versions_updated_at BEFORE UPDATE ON tool_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_purchases_updated_at BEFORE UPDATE ON user_purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- SEED DATA FOR TESTING
-- =====================================================

-- Insert sample projects
INSERT INTO projects (title, slug, description, category, year, image_url, featured, client, goal, tags, order_index) VALUES
('Nike Air Max Campaign', 'nike-air-max-campaign', 'High-energy motion design for Nike''s latest Air Max release featuring dynamic 3D product animations and bold typography.', 'Motion Design', 2024, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800', true, 'Nike', 'Create buzz around the new Air Max release with a visually striking campaign', ARRAY['3D Animation', 'Product Design', 'Branding'], 1),
('Spotify Wrapped 2024', 'spotify-wrapped-2024', 'Animated data visualization and storytelling for Spotify''s year-end user experience.', 'UI Animation', 2024, 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=800', true, 'Spotify', 'Deliver personalized, shareable year-end experiences', ARRAY['Data Viz', 'UI Animation', 'Social Media'], 2),
('Tesla Model Y Launch', 'tesla-model-y-launch', 'Sleek 3D product visualization and kinetic typography for Tesla''s Model Y announcement.', '3D Visualization', 2024, 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800', true, 'Tesla', 'Showcase the Model Y with cinematic flair', ARRAY['3D', 'Automotive', 'Product Launch'], 3),
('Apple WWDC 2024 Opener', 'apple-wwdc-opener', 'Conference opener featuring fluid transitions and innovative visual effects.', 'Motion Design', 2024, 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800', false, 'Apple', 'Set the tone for WWDC with an unforgettable opener', ARRAY['Event', 'Tech', 'Transitions'], 4),
('Airbnb Brand Refresh', 'airbnb-brand-refresh', 'Complete brand animation system including logo reveals, transitions, and UI elements.', 'Branding', 2023, 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800', false, 'Airbnb', 'Modernize the Airbnb brand identity with motion', ARRAY['Branding', 'Logo Animation', 'Design System'], 5);

-- Insert sample tools
INSERT INTO tools (name, slug, short_description, description, category, image_url, featured, order_index) VALUES
('GlitchMaster Pro', 'glitchmaster-pro', 'Professional glitch effect toolkit for After Effects', 'Create stunning glitch effects with 100+ presets, real-time preview, and full customization. Perfect for music videos, tech promos, and modern motion design.', 'After Effects', 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800', true, 1),
('Neon Flow', 'neon-flow', 'Animated neon and glow effects made easy', 'Generate beautiful neon signs, glowing text, and vibrant light trails with one click. Includes 50+ gradient presets and advanced customization options.', 'After Effects', 'https://images.unsplash.com/photo-1567095761054-7a02e69e5c43?w=800', true, 2),
('TypeFlow Studio', 'typeflow-studio', 'Advanced kinetic typography toolkit', 'Bring your text to life with 200+ kinetic typography animations, custom easing controls, and batch processing capabilities.', 'Premiere Pro', 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=800', false, 3);

-- Insert tool versions for GlitchMaster Pro
INSERT INTO tool_versions (tool_id, version_type, tagline, features, whats_included, monthly_price, yearly_price, lifetime_price, download_url, order_index) VALUES
((SELECT id FROM tools WHERE slug = 'glitchmaster-pro'), 'Free', 'Get started with basic glitch effects', 
  ARRAY['10 preset glitch effects', 'Basic customization', 'HD export', 'Community support'],
  ARRAY['AE plugin file', 'Quick start guide', 'Free updates'],
  NULL, NULL, NULL,
  'https://example.com/downloads/glitchmaster-free.zip', 1),
((SELECT id FROM tools WHERE slug = 'glitchmaster-pro'), 'Pro', 'Unlock the full glitch arsenal',
  ARRAY['100+ preset glitch effects', 'Advanced customization', '4K export', 'Priority support', 'Real-time preview', 'Custom presets'],
  ARRAY['AE plugin file', 'Video tutorials', 'Preset library', 'Lifetime updates'],
  19.99, 149.99, 299.99,
  NULL, 2),
((SELECT id FROM tools WHERE slug = 'glitchmaster-pro'), 'Studio', 'For professional studios and teams',
  ARRAY['Everything in Pro', 'Unlimited team seats', 'White-label branding', 'API access', 'Custom development', 'Dedicated account manager'],
  ARRAY['AE plugin file', 'Priority video tutorials', 'Custom preset creation', 'Lifetime updates', 'SLA support'],
  99.99, 799.99, 1499.99,
  NULL, 3);

-- Insert tool versions for Neon Flow
INSERT INTO tool_versions (tool_id, version_type, tagline, features, whats_included, monthly_price, yearly_price, lifetime_price, download_url, order_index) VALUES
((SELECT id FROM tools WHERE slug = 'neon-flow'), 'Free', 'Basic neon effects for everyone',
  ARRAY['5 neon presets', 'Basic glow controls', 'HD export'],
  ARRAY['AE plugin file', 'Quick start PDF'],
  NULL, NULL, NULL,
  'https://example.com/downloads/neonflow-free.zip', 1),
((SELECT id FROM tools WHERE slug = 'neon-flow'), 'Pro', 'Professional neon toolkit',
  ARRAY['50+ neon presets', 'Advanced glow & blur', '4K export', 'Gradient editor', 'Animation curves'],
  ARRAY['AE plugin file', 'Video tutorials', 'Lifetime updates'],
  14.99, 99.99, 199.99,
  NULL, 2);

-- Insert team members
INSERT INTO team_members (name, role, bio, image_url, social_links, order_index) VALUES
('Alex Rivera', 'Creative Director & Founder', 'With 10+ years in motion design, Alex has led projects for Nike, Apple, and Spotify. Specializes in 3D animation and brand storytelling.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', 
  '{"linkedin": "https://linkedin.com/in/alexrivera", "instagram": "https://instagram.com/alexrivera"}', 1),
('Sarah Chen', 'Lead Motion Designer', '8 years of experience crafting elegant UI animations and kinetic typography. Former designer at Google and Meta.', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
  '{"dribbble": "https://dribbble.com/sarahchen", "behance": "https://behance.net/sarahchen"}', 2),
('Marcus Johnson', 'Senior 3D Artist', 'Specialist in product visualization and CGI. Previously worked on campaigns for Tesla, Sony, and Samsung.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
  '{"behance": "https://behance.net/marcusj", "instagram": "https://instagram.com/marcusj3d"}', 3);

-- Insert site settings
INSERT INTO site_settings (key, value) VALUES
('social_media', '{"linkedin": "https://linkedin.com/company/fastoosh", "instagram": "https://instagram.com/fastoosh", "x": "https://twitter.com/fastoosh"}'),
('contact_email', '"hello@fastoosh.com"'),
('hero_tagline', '"Premium Motion Design for Bold Brands"'),
('hero_description', '"We create high-end custom motion design and develop powerful tools for creative professionals worldwide."');

-- =====================================================
-- DONE! Your database is ready.
-- =====================================================
-- Next steps:
-- 1. Set up OAuth providers in Supabase Auth settings
-- 2. Configure Lemon Squeezy webhook endpoint
-- 3. Update backend to use these tables
-- =====================================================
