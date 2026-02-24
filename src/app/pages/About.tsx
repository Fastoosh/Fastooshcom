import { motion } from "motion/react";
import { GlassCard } from "../components/shared/GlassCard";
import { NeonButton } from "../components/shared/NeonButton";
import { Target, Zap, Heart, Shield } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLinkedin, faInstagram, faBehance, faDribbble } from "@fortawesome/free-brands-svg-icons";
import { useState, useEffect } from "react";
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  imageUrl: string;
  socialLinks: Record<string, string>;
}

const values = [
  {
    icon: Target,
    title: "Clarity",
    description: "Clear communication, transparent process, no surprises."
  },
  {
    icon: Zap,
    title: "Speed",
    description: "Fast turnaround without compromising on quality."
  },
  {
    icon: Heart,
    title: "Craft",
    description: "Obsessive attention to detail in every frame."
  },
  {
    icon: Shield,
    title: "Reliability",
    description: "On-time delivery, always. Your deadlines are sacred."
  },
];

const clientLogos = [
  "Google", "Apple", "Nike", "Adobe", "Spotify", "Netflix", "Tesla", "Stripe", "Figma", "Notion", "Slack", "Airbnb"
];

export function About() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    try {
      const response = await fetch(`${API_BASE}/team`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setTeam(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching team:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-24"
        >
          <h1 className="text-5xl md:text-6xl tracking-tight mb-6">
            Motion design studio
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Remote worldwide
            </span>
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            We're a small team of motion designers obsessed with craft, speed, and clarity.
          </p>
        </motion.div>

        {/* Story */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-24"
        >
          <GlassCard className="p-12">
            <div className="max-w-3xl mx-auto space-y-6 text-white/70 text-lg leading-relaxed">
              <p>
                Fastoosh started in 2019 as a side project. We were frustrated with slow turnarounds 
                and unclear communication in the motion design industry.
              </p>
              <p>
                So we built a studio focused on three things: <span className="text-white">premium craft</span>, 
                <span className="text-white"> fast execution</span>, and <span className="text-white">crystal-clear process</span>.
              </p>
              <p>
                Today, we work with ambitious startups and Fortune 500 companies worldwide. 
                Every project gets the same attention to detail, whether it's a 15-second social ad 
                or a full brand identity system.
              </p>
              <p className="text-white">
                We're remote-first, NDA-friendly, and reply within 24-48 hours.
              </p>
            </div>
          </GlassCard>
        </motion.div>

        {/* Values */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-24"
        >
          <h2 className="text-3xl text-center mb-12">What drives us</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassCard className="p-6 text-center h-full">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                    <value.icon className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-xl mb-2">{value.title}</h3>
                  <p className="text-white/60 text-sm">{value.description}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Team */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-24"
        >
          <h2 className="text-3xl text-center mb-12">Small team, big impact</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassCard hover className="overflow-hidden">
                  <div className="aspect-square overflow-hidden">
                    <img 
                      src={member.imageUrl} 
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg mb-1">{member.name}</h3>
                    <p className="text-purple-400 text-sm mb-3">{member.role}</p>
                    <p className="text-white/60 text-sm mb-4">{member.bio}</p>
                    
                    {/* Social Links */}
                    {member.socialLinks && Object.keys(member.socialLinks).some(key => member.socialLinks[key]) && (
                      <div className="flex gap-2 pt-3 border-t border-white/10">
                        {member.socialLinks.linkedin && (
                          <a
                            href={member.socialLinks.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-purple-500/20 flex items-center justify-center transition-colors group"
                          >
                            <FontAwesomeIcon icon={faLinkedin} className="w-4 h-4 text-white/60 group-hover:text-purple-400 transition-colors" />
                          </a>
                        )}
                        {member.socialLinks.instagram && (
                          <a
                            href={member.socialLinks.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-purple-500/20 flex items-center justify-center transition-colors group"
                          >
                            <FontAwesomeIcon icon={faInstagram} className="w-4 h-4 text-white/60 group-hover:text-purple-400 transition-colors" />
                          </a>
                        )}
                        {member.socialLinks.behance && (
                          <a
                            href={member.socialLinks.behance}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-purple-500/20 flex items-center justify-center transition-colors group"
                          >
                            <FontAwesomeIcon icon={faBehance} className="w-4 h-4 text-white/60 group-hover:text-purple-400 transition-colors" />
                          </a>
                        )}
                        {member.socialLinks.dribbble && (
                          <a
                            href={member.socialLinks.dribbble}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-purple-500/20 flex items-center justify-center transition-colors group"
                          >
                            <FontAwesomeIcon icon={faDribbble} className="w-4 h-4 text-white/60 group-hover:text-purple-400 transition-colors" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Clients */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-24"
        >
          <h2 className="text-3xl text-center mb-12">Trusted by</h2>
          <GlassCard className="p-12">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
              {clientLogos.map((logo, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
                >
                  <span className="text-sm">{logo}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <GlassCard neonBorder className="p-12">
            <h3 className="text-3xl mb-4">Let's work together</h3>
            <p className="text-white/60 mb-8 max-w-2xl mx-auto">
              We're always looking for exciting projects. If you're building something ambitious, 
              let's talk.
            </p>
            <NeonButton href="/work-with-us">Work with us</NeonButton>
            <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-white/50">
              <span>✓ Remote worldwide</span>
              <span>✓ Reply in 24-48h</span>
              <span>✓ NDA-friendly</span>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}