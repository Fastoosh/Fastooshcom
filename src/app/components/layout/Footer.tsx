import { useState, useEffect } from 'react';
import { Link } from "react-router";
import { Mail } from "lucide-react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLinkedin, 
  faInstagram, 
  faXTwitter, 
  faDribbble, 
  faBehance, 
  faTiktok 
} from '@fortawesome/free-brands-svg-icons';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { useLogo } from '../../context/LogoContext';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

/** Retries a fetch up to `retries` times with exponential back-off. */
async function retryFetch(url: string, options: RequestInit, retries = 3, delay = 1200): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delay * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
  throw new Error('retryFetch: unreachable');
}

interface SocialLinks {
  linkedin?: string;
  instagram?: string;
  twitter?: string;
  dribbble?: string;
  behance?: string;
  tiktok?: string;
}

export function Footer() {
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [contactEmail, setContactEmail] = useState('');
  const { activeLogoUrl, logoText, logoHeight } = useLogo();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await retryFetch(`${API_BASE}/settings`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          if (result.data.socialLinks) setSocialLinks(result.data.socialLinks);
          if (result.data.contactEmail) setContactEmail(result.data.contactEmail);
        }
      }
    } catch (error) {
      console.error('Error fetching footer settings:', error);
    }
  };

  // Define social media config with icons and labels
  const socialMediaConfig = [
    { 
      key: 'linkedin', 
      icon: faLinkedin, 
      label: 'LinkedIn',
      url: socialLinks.linkedin 
    },
    { 
      key: 'instagram', 
      icon: faInstagram, 
      label: 'Instagram',
      url: socialLinks.instagram 
    },
    { 
      key: 'twitter', 
      icon: faXTwitter, 
      label: 'X (Twitter)',
      url: socialLinks.twitter 
    },
    { 
      key: 'dribbble', 
      icon: faDribbble, 
      label: 'Dribbble',
      url: socialLinks.dribbble 
    },
    { 
      key: 'behance', 
      icon: faBehance, 
      label: 'Behance',
      url: socialLinks.behance 
    },
    { 
      key: 'tiktok', 
      icon: faTiktok, 
      label: 'TikTok',
      url: socialLinks.tiktok 
    },
  ];

  // Filter to only show filled social links
  const activeSocialLinks = socialMediaConfig.filter(social => social.url && social.url.trim() !== '');

  return (
    <footer
      className="border-t border-white/5 backdrop-blur-2xl"
      style={{ backgroundColor: 'var(--fastoosh-footer-bg, rgba(0,0,0,0.30))' }}
    >
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="tracking-tight">
              {activeLogoUrl ? (
                <img
                  src={activeLogoUrl}
                  alt={logoText}
                  style={{ height: `${logoHeight}px` }}
                  className="w-auto object-contain"
                />
              ) : (
                <span className="text-2xl font-bold bg-gradient-to-r from-violet-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                  {logoText}
                </span>
              )}
            </div>
            <p className="text-white/60 text-sm">
              Premium motion design studio.
              <br />
              Remote worldwide.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white mb-4">Studio</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/projects" className="text-white/60 hover:text-white transition-colors">
                  Projects
                </Link>
              </li>
              <li>
                <Link to="/tools" className="text-white/60 hover:text-white transition-colors">
                  Tools
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-white/60 hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link to="/work-with-us" className="text-white/60 hover:text-white transition-colors">
                  Work with us
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white mb-4">Get in touch</h4>
            {contactEmail ? (
              <a
                href={`mailto:${contactEmail}`}
                className="text-white/60 hover:text-white transition-colors text-sm inline-flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                {contactEmail}
              </a>
            ) : (
              <p className="text-white/40 text-sm">No contact email configured</p>
            )}
          </div>

          {/* Social */}
          <div>
            <h4 className="text-white mb-4">Follow</h4>
            {activeSocialLinks.length > 0 ? (
              <div className="flex gap-4 flex-wrap">
                {activeSocialLinks.map((social) => (
                  <a 
                    key={social.key}
                    href={social.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-white/60 hover:text-white transition-colors" 
                    aria-label={social.label}
                  >
                    <FontAwesomeIcon icon={social.icon} className="w-5 h-5" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-white/40 text-sm">No social links configured</p>
            )}
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-white/40">
          <p>© 2026 Fastoosh. All rights reserved.</p>
          <p className="text-white/60">Remote worldwide • Reply in 24-48h • NDA-friendly</p>
        </div>
      </div>
    </footer>
  );
}