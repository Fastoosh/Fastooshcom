import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { InlineWidget } from "react-calendly";
import { GlassCard } from "../components/shared/GlassCard";
import { NeonButton } from "../components/shared/NeonButton";
import { SeoHead } from "../components/shared/SeoHead";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../hooks/useLanguage";
import {
  CheckCircle2, Mail, Clock, Calendar, FileText, ArrowRight,
  ChevronLeft, Loader2, Shield, Globe, Zap, MessageSquare,
} from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

type Path = "choose" | "call" | "brief";
type CallStage = "prescreen" | "calendly";

export function WorkWithUs() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  // Translated arrays (re-evaluated on language change)
  const callSteps    = t('workWithUs.callSteps',    { returnObjects: true }) as Array<{ title: string; body: string }>;
  const briefSteps   = t('workWithUs.briefSteps',   { returnObjects: true }) as Array<{ title: string; body: string }>;
  const projectTypes = t('workWithUs.projectTypes', { returnObjects: true }) as string[];
  const budgetRanges = t('workWithUs.budgetRanges', { returnObjects: true }) as string[];
  const timelines    = t('workWithUs.timelines',    { returnObjects: true }) as string[];
  const trustBadges  = t('workWithUs.trustBadges',  { returnObjects: true }) as string[];
  const trustSignalsData = t('workWithUs.trustSignals', { returnObjects: true }) as Array<{ title: string; body: string }>;

  // ── Calendly URL from settings ──────────────────────────────────────────
  const [calendlyUrl,     setCalendlyUrl]     = useState<string>("");
  const [calendlyLoading, setCalendlyLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/settings`, { headers: { Authorization: `Bearer ${publicAnonKey}` } })
      .then(r => r.json())
      .then(res => setCalendlyUrl(res.data?.calendlyUrl || ""))
      .catch(err => console.error("Failed to load Calendly URL:", err))
      .finally(() => setCalendlyLoading(false));
  }, []);

  // ── State ───────────────────────────────────────────────────────────────
  const [path,      setPath]      = useState<Path>("choose");
  const [callStage, setCallStage] = useState<CallStage>("prescreen");
  const [prescreen, setPrescreen] = useState({ name: "", email: "", projectType: "", budget: "" });
  const [formData,  setFormData]  = useState({ name: "", email: "", projectType: "", timeline: "", budget: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });

  const handlePrescreenChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setPrescreen({ ...prescreen, [e.target.name]: e.target.value });

  const handlePrescreenSubmit = (e: React.FormEvent) => { e.preventDefault(); setCallStage("calendly"); };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });
    try {
      const res    = await fetch(`${API_BASE}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (result.success) {
        setSubmitStatus({ type: "success", message: result.message || t('workWithUs.successMsg') });
        setFormData({ name: "", email: "", projectType: "", timeline: "", budget: "", message: "" });
      } else {
        setSubmitStatus({ type: "error", message: result.error || "Failed to send. Please try again." });
      }
    } catch {
      setSubmitStatus({ type: "error", message: "An unexpected error occurred. Try emailing us directly." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetPath = () => {
    setPath("choose");
    setCallStage("prescreen");
    setPrescreen({ name: "", email: "", projectType: "", budget: "" });
  };

  const activeSteps = path === "call" ? callSteps : briefSteps;

  const inputCls = "w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all";

  // Map trust signals with icons (icons stay the same regardless of language)
  const trustSignals = [
    { icon: Zap,           color: "text-yellow-400", ...trustSignalsData[0] },
    { icon: Shield,        color: "text-green-400",  ...trustSignalsData[1] },
    { icon: Globe,         color: "text-blue-400",   ...trustSignalsData[2] },
    { icon: MessageSquare, color: "text-purple-400", ...trustSignalsData[3] },
  ];

  return (
    <div className="min-h-screen py-24 px-6">
      <SeoHead
        pageKey="work-with-us"
        fallback={{
          title: "Work With Us — Hire Fastoosh Motion Design Studio",
          description: "Book a discovery call or send a project brief. Premium motion design for brands worldwide.",
        }}
      />

      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl md:text-6xl tracking-tight mb-6">
            {t('workWithUs.titleLine1')}
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              {t('workWithUs.titleLine2')}
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto">
            {t('workWithUs.subtitle')}
          </p>
        </motion.div>

        {/* Path chooser */}
        <AnimatePresence mode="wait">
          {path === "choose" && (
            <motion.div key="chooser" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">

              {/* Book a Call */}
              <motion.button onClick={() => setPath("call")} whileHover={{ scale: 1.02, y: -4 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.25 }} className="text-left rtl:text-right group">
                <GlassCard neonBorder className="p-8 h-full cursor-pointer group-hover:shadow-[0_0_50px_rgba(168,85,247,0.25)] transition-shadow duration-300">
                  <div className="flex flex-col h-full gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-500/30 flex items-center justify-center">
                      <Calendar className="w-7 h-7 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h2 className="text-2xl">{t('workWithUs.bookCall')}</h2>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">{t('workWithUs.tagRecommended')}</span>
                      </div>
                      <p className="text-white/60 leading-relaxed mb-6">{t('workWithUs.bookCallDesc')}</p>
                      <ul className="space-y-2">
                        {callSteps.slice(0, 3).map((s, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-white/70">
                            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                            {s.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-center gap-2 rtl:flex-row-reverse text-purple-400 font-medium text-sm group-hover:gap-3 transition-all duration-200">
                      {t('workWithUs.bookCall')} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </div>
                  </div>
                </GlassCard>
              </motion.button>

              {/* Send a Brief */}
              <motion.button onClick={() => setPath("brief")} whileHover={{ scale: 1.02, y: -4 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.25 }} className="text-left rtl:text-right group">
                <GlassCard className="p-8 h-full cursor-pointer border-white/10 group-hover:border-white/20 group-hover:shadow-[0_0_50px_rgba(59,130,246,0.15)] transition-all duration-300">
                  <div className="flex flex-col h-full gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
                      <FileText className="w-7 h-7 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h2 className="text-2xl">{t('workWithUs.sendBrief')}</h2>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-white/50 border border-white/10 font-medium">{t('workWithUs.tagAsync')}</span>
                      </div>
                      <p className="text-white/60 leading-relaxed mb-6">{t('workWithUs.sendBriefDesc')}</p>
                      <ul className="space-y-2">
                        {briefSteps.slice(0, 3).map((s, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-white/70">
                            <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            {s.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-center gap-2 rtl:flex-row-reverse text-blue-400 font-medium text-sm group-hover:gap-3 transition-all duration-200">
                      {t('workWithUs.sendBrief')} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </div>
                  </div>
                </GlassCard>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Two-column layout */}
        <AnimatePresence mode="wait">
          {path !== "choose" && (
            <motion.div key="content" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12">

              {/* Left: process + trust */}
              <div className="space-y-8">
                <button onClick={resetPath} className="flex items-center gap-2 rtl:flex-row-reverse text-white/50 hover:text-white transition-colors text-sm">
                  <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                  {t('workWithUs.backToOptions')}
                </button>

                <div className="flex items-center gap-3 rtl:flex-row-reverse">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${path === "call" ? "bg-purple-500/20 border border-purple-500/30" : "bg-blue-500/20 border border-blue-500/30"}`}>
                    {path === "call" ? <Calendar className="w-5 h-5 text-purple-400" /> : <FileText className="w-5 h-5 text-blue-400" />}
                  </div>
                  <h2 className="text-2xl">{path === "call" ? t('workWithUs.bookCall') : t('workWithUs.sendBrief')}</h2>
                </div>

                <div className="space-y-4">
                  {activeSteps.map((step, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: isRTL ? 16 : -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: i * 0.08 }}>
                      <GlassCard className="p-5">
                        <div className="flex gap-4 rtl:flex-row-reverse">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${path === "call" ? "bg-gradient-to-br from-purple-500 to-blue-500" : "bg-gradient-to-br from-blue-500 to-cyan-500"}`}>
                            {i + 1}
                          </div>
                          <div>
                            <h3 className="text-base font-medium mb-1">{step.title}</h3>
                            <p className="text-white/55 text-sm leading-relaxed">{step.body}</p>
                          </div>
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))}
                </div>

                <GlassCard className="p-6 bg-white/[0.02]">
                  <h3 className="text-lg mb-5">{t('workWithUs.whyChooseTitle')}</h3>
                  <div className="space-y-4">
                    {trustSignals.map(({ icon: Icon, color, title, body }) => (
                      <div key={title} className="flex items-start gap-3">
                        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${color}`} />
                        <div className={`${isRTL ? 'text-right order-1' : ''} flex-1`}>
                          <div className="font-medium text-sm mb-0.5">{title}</div>
                          <p className="text-white/55 text-xs">{body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                <div className="flex items-center gap-3 rtl:flex-row-reverse text-white/50">
                  <Mail className="w-4 h-4" />
                  <div>
                    <div className="text-xs mb-0.5">{t('workWithUs.orEmailDirectly')}</div>
                    <a href="mailto:youssef@fastoosh.com" className="text-white/80 hover:text-purple-400 transition-colors text-sm">
                      youssef@fastoosh.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Right: form / calendly */}
              <div>
                <AnimatePresence mode="wait">

                  {/* CALL pre-screen */}
                  {path === "call" && callStage === "prescreen" && (
                    <motion.div key="prescreen" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.4 }}>
                      <GlassCard neonBorder className="p-8">
                        <div className="flex items-center gap-3 mb-2">
                          <Clock className="w-5 h-5 text-purple-400" />
                          <h3 className="text-xl">{t('workWithUs.prescreenTitle')}</h3>
                        </div>
                        <p className="text-white/50 text-sm mb-8">{t('workWithUs.prescreenSubtitle')}</p>
                        <form onSubmit={handlePrescreenSubmit} className="space-y-5">
                          <div>
                            <label className="block text-sm mb-2">{t('workWithUs.yourName')} <span className="text-red-400">*</span></label>
                            <input type="text" name="name" required value={prescreen.name} onChange={handlePrescreenChange} placeholder="Alex Johnson" className={inputCls} />
                          </div>
                          <div>
                            <label className="block text-sm mb-2">{t('workWithUs.yourEmail')} <span className="text-red-400">*</span></label>
                            <input type="email" name="email" required value={prescreen.email} onChange={handlePrescreenChange} placeholder="alex@company.com" className={inputCls} />
                          </div>
                          <div>
                            <label className="block text-sm mb-2">{t('workWithUs.projectType')}</label>
                            <select name="projectType" value={prescreen.projectType} onChange={handlePrescreenChange} className={inputCls}>
                              <option value="" className="bg-gray-900">{t('workWithUs.selectProjectType')}</option>
                              {projectTypes.map(pt => <option key={pt} value={pt} className="bg-gray-900">{pt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm mb-2">{t('workWithUs.budget')}</label>
                            <select name="budget" value={prescreen.budget} onChange={handlePrescreenChange} className={inputCls}>
                              <option value="" className="bg-gray-900">{t('workWithUs.selectBudget')}</option>
                              {budgetRanges.map(r => <option key={r} value={r} className="bg-gray-900">{r}</option>)}
                            </select>
                          </div>
                          <NeonButton type="submit" className="w-full justify-center">
                            Continue to calendar <ArrowRight className="w-4 h-4 ml-1 rtl:ml-0 rtl:mr-1 rtl:rotate-180" />
                          </NeonButton>
                          <p className="text-center text-xs text-white/35">{t('workWithUs.freeNoCommitment')}</p>
                        </form>
                      </GlassCard>
                    </motion.div>
                  )}

                  {/* CALL Calendly */}
                  {path === "call" && callStage === "calendly" && (
                    <motion.div key="calendly" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.4 }}>
                      <GlassCard neonBorder className="overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between rtl:flex-row-reverse">
                          <div className="flex items-center gap-3 rtl:flex-row-reverse">
                            <Calendar className="w-5 h-5 text-purple-400" />
                            <div>
                              <div className="text-sm font-medium">{t('workWithUs.pickTimeSlot')}</div>
                              {prescreen.name && <div className="text-xs text-white/40">Booked for {prescreen.name}</div>}
                            </div>
                          </div>
                          <button onClick={() => setCallStage("prescreen")} className="text-xs text-white/40 hover:text-white/70 transition-colors flex items-center gap-1 rtl:flex-row-reverse">
                            <ChevronLeft className="w-3 h-3 rtl:rotate-180" /> Edit info
                          </button>
                        </div>
                        {calendlyLoading ? (
                          <div className="flex items-center justify-center h-[400px]"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>
                        ) : !calendlyUrl ? (
                          <div className="flex flex-col items-center justify-center h-[400px] gap-4 px-8 text-center">
                            <Calendar className="w-10 h-10 text-white/20" />
                            <p className="text-white/50 text-sm">Calendly URL not configured yet.</p>
                            <p className="text-white/30 text-xs">Go to Admin → Settings → Calendly Booking URL to set it up.</p>
                          </div>
                        ) : (
                          <InlineWidget url={calendlyUrl}
                            prefill={{ name: prescreen.name, email: prescreen.email, customAnswers: { a1: prescreen.projectType, a2: prescreen.budget } }}
                            styles={{ minWidth: "320px", height: "700px" }}
                            pageSettings={{ backgroundColor: "040408", hideEventTypeDetails: false, hideLandingPageDetails: false, primaryColor: "a855f7", textColor: "ffffff" }}
                          />
                        )}
                      </GlassCard>
                    </motion.div>
                  )}

                  {/* BRIEF form */}
                  {path === "brief" && (
                    <motion.div key="brief-form" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.4 }}>
                      <GlassCard neonBorder className="p-8 sticky top-24" style={{ "--tw-border-opacity": "1" } as React.CSSProperties}>
                        <div className="flex items-center gap-3 mb-2">
                          <FileText className="w-5 h-5 text-blue-400" />
                          <h3 className="text-xl">{t('workWithUs.formTitle')}</h3>
                        </div>
                        <p className="text-white/50 text-sm mb-8">{t('workWithUs.formSubtitle')}</p>

                        {submitStatus.type === "success" ? (
                          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
                            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                            <h3 className="text-xl mb-2">{t('workWithUs.successMsg')}</h3>
                            <p className="text-white/50 text-sm">We'll be in touch within 24–48 hours.</p>
                          </motion.div>
                        ) : (
                          <form onSubmit={handleFormSubmit} className="space-y-5">
                            <div>
                              <label className="block text-sm mb-2">{t('workWithUs.yourName')} <span className="text-red-400">*</span></label>
                              <input type="text" name="name" required value={formData.name} onChange={handleFormChange} placeholder="Your name" className={inputCls} />
                            </div>
                            <div>
                              <label className="block text-sm mb-2">{t('workWithUs.yourEmail')} <span className="text-red-400">*</span></label>
                              <input type="email" name="email" required value={formData.email} onChange={handleFormChange} placeholder="your@email.com" className={inputCls} />
                            </div>
                            <div>
                              <label className="block text-sm mb-2">{t('workWithUs.projectType')}</label>
                              <select name="projectType" value={formData.projectType} onChange={handleFormChange} className={inputCls}>
                                <option value="" className="bg-gray-900">{t('workWithUs.selectProjectType')}</option>
                                {projectTypes.map(pt => <option key={pt} value={pt} className="bg-gray-900">{pt}</option>)}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm mb-2">{t('workWithUs.timeline')}</label>
                                <select name="timeline" value={formData.timeline} onChange={handleFormChange} className={inputCls}>
                                  <option value="" className="bg-gray-900">{t('workWithUs.selectTimeline')}</option>
                                  {timelines.map(tl => <option key={tl} value={tl} className="bg-gray-900">{tl}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm mb-2">{t('workWithUs.budget')}</label>
                                <select name="budget" value={formData.budget} onChange={handleFormChange} className={inputCls}>
                                  <option value="" className="bg-gray-900">{t('workWithUs.selectBudget')}</option>
                                  {budgetRanges.map(r => <option key={r} value={r} className="bg-gray-900">{r}</option>)}
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm mb-2">{t('workWithUs.projectDescription')}</label>
                              <textarea name="message" rows={5} value={formData.message} onChange={handleFormChange}
                                placeholder={t('workWithUs.projectDescPlaceholder')}
                                className={`${inputCls} resize-none`} />
                            </div>

                            {submitStatus.type === "error" && (
                              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{submitStatus.message}</div>
                            )}

                            <NeonButton type="submit" disabled={isSubmitting} className="w-full justify-center">
                              {isSubmitting
                                ? <><Loader2 className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2 animate-spin" />{t('workWithUs.sending')}</>
                                : <>{t('workWithUs.sendBriefBtn')} <ArrowRight className="w-4 h-4 ml-1 rtl:ml-0 rtl:mr-1 rtl:rotate-180" /></>}
                            </NeonButton>

                            <div className="flex flex-wrap justify-center gap-4 text-xs text-white/30 pt-2">
                              {trustBadges.map(b => <span key={b}>{b}</span>)}
                            </div>
                          </form>
                        )}
                      </GlassCard>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}