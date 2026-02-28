import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { GlassCard } from "../components/shared/GlassCard";
import { NeonButton } from "../components/shared/NeonButton";
import { SeoHead } from "../components/shared/SeoHead";
import { Target, Zap, Heart, Shield } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLinkedin, faInstagram, faBehance, faDribbble } from "@fortawesome/free-brands-svg-icons";
import { useTranslation } from "react-i18next";
import { fetchTranslations, deepMergeTranslations } from "../utils/translations";
import { api } from "../utils/api";

// (projectId / publicAnonKey no longer needed — team is fetched via api.getTeam())

interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  imageUrl: string;
  socialLinks: Record<string, string>;
}

const VALUE_ICONS = [Target, Zap, Heart, Shield];

const clientLogos = [
  "Google", "Apple", "Nike", "Adobe", "Spotify", "Netflix",
  "Tesla", "Stripe", "Figma", "Notion", "Slack", "Airbnb",
];

export function About() {
  const { t, i18n } = useTranslation();
  const [team,    setTeam]    = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Covers initial mount AND language changes — fetches team + translations in
  // one Promise.all so members always render translated on the first paint.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTeam(i18n.language); }, [i18n.language]);

  const fetchTeam = async (lang = i18n.language) => {
    try {
      const [res, trans] = await Promise.all([
        api.getTeam(),
        lang !== 'en' ? fetchTranslations(lang, 'team') : Promise.resolve({}),
      ]);
      if (res.success) {
        const members: TeamMember[] = res.data || [];
        const merged = lang !== 'en' && Object.keys(trans).length > 0
          ? members.map(m => m.id && (trans as Record<string, any>)[m.id]
              ? deepMergeTranslations(m, (trans as Record<string, any>)[m.id]) as TeamMember
              : m)
          : members;
        setTeam(merged);
      }
    } catch (error) {
      console.error('Error fetching team:', error);
    } finally {
      setLoading(false);
    }
  };

  // Values with translated text, icons stay in code — memoised per language (Option 4)
  const values = useMemo(() =>
    (t('about.values', { returnObjects: true }) as Array<{ title: string; description: string }>)
      .map((v, i) => ({ ...v, icon: VALUE_ICONS[i] })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [i18n.language]);

  return (
    <div className="min-h-screen py-24 px-6">
      <SeoHead
        pageKey="about"
        fallback={{
          title: "About — Fastoosh Motion Design Studio",
          description: "Meet the Fastoosh team — a collective of motion designers, animators, and VFX artists passionate about crafting extraordinary visual experiences.",
        }}
      />
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-24"
        >
          <h1 className="text-5xl md:text-6xl tracking-tight mb-6">
            {t('about.titleLine1')}
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              {t('about.titleLine2')}
            </span>
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            {t('about.subtitle')}
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
              <p>{t('about.story1')}</p>
              <p>
                {t('about.story2Pre')}
                <span className="text-white">{t('about.story2Bold1')}</span>
                {t('about.story2Mid1')}
                <span className="text-white">{t('about.story2Bold2')}</span>
                {t('about.story2Mid2')}
                <span className="text-white">{t('about.story2Bold3')}</span>
                {t('about.story2Post')}
              </p>
              <p>{t('about.story3')}</p>
              <p className="text-white">{t('about.story4')}</p>
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
          <h2 className="text-3xl text-center mb-12">{t('about.valuesHeading')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <motion.div
                key={index}
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
        {!loading && team.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-24"
          >
            <h2 className="text-3xl text-center mb-12">{t('about.teamHeading')}</h2>
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
                      {member.socialLinks && Object.keys(member.socialLinks).some(k => member.socialLinks[k]) && (
                        <div className="flex gap-2 pt-3 border-t border-white/10 rtl:flex-row-reverse">
                          {member.socialLinks.linkedin && (
                            <a href={member.socialLinks.linkedin} target="_blank" rel="noopener noreferrer"
                              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-purple-500/20 flex items-center justify-center transition-colors group">
                              <FontAwesomeIcon icon={faLinkedin} className="w-4 h-4 text-white/60 group-hover:text-purple-400 transition-colors" />
                            </a>
                          )}
                          {member.socialLinks.instagram && (
                            <a href={member.socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-purple-500/20 flex items-center justify-center transition-colors group">
                              <FontAwesomeIcon icon={faInstagram} className="w-4 h-4 text-white/60 group-hover:text-purple-400 transition-colors" />
                            </a>
                          )}
                          {member.socialLinks.behance && (
                            <a href={member.socialLinks.behance} target="_blank" rel="noopener noreferrer"
                              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-purple-500/20 flex items-center justify-center transition-colors group">
                              <FontAwesomeIcon icon={faBehance} className="w-4 h-4 text-white/60 group-hover:text-purple-400 transition-colors" />
                            </a>
                          )}
                          {member.socialLinks.dribbble && (
                            <a href={member.socialLinks.dribbble} target="_blank" rel="noopener noreferrer"
                              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-purple-500/20 flex items-center justify-center transition-colors group">
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
        )}

        {/* Clients */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-24"
        >
          <h2 className="text-3xl text-center mb-12">{t('about.clientsHeading')}</h2>
          <GlassCard className="p-12">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
              {clientLogos.map((logo, index) => (
                <div key={index} className="flex items-center justify-center text-white/40 hover:text-white/70 transition-colors">
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
          <GlassCard className="p-12 w-full">
            <h3 className="text-3xl mb-4">{t('about.ctaHeading')}</h3>
            <p className="text-white/60 mb-8 max-w-2xl mx-auto">{t('about.ctaSubtitle')}</p>
            <NeonButton href="/work-with-us">{t('common.workWithUs')}</NeonButton>
            <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-white/50">
              <span>{t('common.remoteWorldwide')}</span>
              <span>{t('common.replyTime')}</span>
              <span>{t('common.ndaFriendly')}</span>
            </div>
          </GlassCard>
        </motion.div>

      </div>
    </div>
  );
}