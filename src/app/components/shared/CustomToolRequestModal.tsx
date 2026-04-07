import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Wrench, Loader2, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { projectId, publicAnonKey } from "/utils/supabase/info";

interface Props {
  open: boolean;
  onClose: () => void;
}

// ── Inline translations (modal-specific) ─────────────────────────────────────
const MODAL_I18N: Record<string, Record<string, string | string[]>> = {
  en: {
    badge:        "Custom Tool Commission",
    title:        "Build a tool for your workflow",
    subtitle:     "Tell us what you need automated and we'll build it specifically for your production pipeline.",
    nameLabel:    "Full Name",
    namePh:       "Your name",
    emailLabel:   "Email",
    emailPh:      "you@studio.com",
    softwareLabel:"Software",
    workflowLabel:"Describe your workflow",
    workflowPh:   "What do you currently do manually that slows you down? Describe the repetitive task or process.",
    automateLabel:"What should the tool do?",
    automatePh:   "What exactly should the tool automate or solve? Be as specific as possible.",
    timelineLabel:"Timeline",
    timelinePh:   "Select a timeline",
    budgetLabel:  "Budget range",
    budgetPh:     "Select your budget",
    notesLabel:   "Additional notes (optional)",
    notesPh:      "Any references, inspirations, or technical constraints to know about?",
    submit:       "Send commission request",
    sending:      "Sending…",
    successTitle: "Request received!",
    successMsg:   "We'll review your request and get back to you within 48 hours with a feasibility assessment and quote.",
    errorPrefix:  "Something went wrong:",
    required:     "Please fill in all required fields.",
    timelines:    ["ASAP (rush)", "Within 1 month", "2–3 months", "Flexible / No rush"],
    budgets:      ["Under $500", "$500 – $1,500", "$1,500 – $5,000", "$5,000+", "Let's discuss"],
    softwares:    ["After Effects", "Premiere Pro", "DaVinci Resolve", "Cinema 4D", "Blender", "Other"],
  },
  fr: {
    badge:        "Commission d'outil sur mesure",
    title:        "Créons un outil pour votre workflow",
    subtitle:     "Dites-nous ce que vous souhaitez automatiser et nous le développerons spécifiquement pour votre pipeline de production.",
    nameLabel:    "Nom complet",
    namePh:       "Votre nom",
    emailLabel:   "E-mail",
    emailPh:      "vous@studio.com",
    softwareLabel:"Logiciel(s)",
    workflowLabel:"Décrivez votre workflow",
    workflowPh:   "Qu'est-ce que vous faites actuellement manuellement et qui vous ralentit ? Décrivez la tâche répétitive.",
    automateLabel:"Que doit faire l'outil ?",
    automatePh:   "Qu'est-ce que l'outil doit exactement automatiser ou résoudre ? Soyez aussi précis que possible.",
    timelineLabel:"Délai souhaité",
    timelinePh:   "Choisir un délai",
    budgetLabel:  "Budget estimé",
    budgetPh:     "Choisir un budget",
    notesLabel:   "Notes supplémentaires (optionnel)",
    notesPh:      "Des références, inspirations ou contraintes techniques à signaler ?",
    submit:       "Envoyer la demande",
    sending:      "Envoi en cours…",
    successTitle: "Demande reçue !",
    successMsg:   "Nous examinerons votre demande et vous répondrons dans les 48 heures avec une évaluation de faisabilité et un devis.",
    errorPrefix:  "Une erreur est survenue :",
    required:     "Veuillez remplir tous les champs obligatoires.",
    timelines:    ["Urgent (rush)", "Dans 1 mois", "2 à 3 mois", "Flexible / Pas pressé"],
    budgets:      ["Moins de 500 $", "500 $ – 1 500 $", "1 500 $ – 5 000 $", "5 000 $+", "À discuter"],
    softwares:    ["After Effects", "Premiere Pro", "DaVinci Resolve", "Cinema 4D", "Blender", "Autre"],
  },
  ar: {
    badge:        "طلب أداة مخصصة",
    title:        "لنبني أداة لسير عملك",
    subtitle:     "أخبرنا بما تريد أتمتته وسنبنيه خصيصاً لخط إنتاجك.",
    nameLabel:    "الاسم الكامل",
    namePh:       "اسمك",
    emailLabel:   "البريد الإلكتروني",
    emailPh:      "you@studio.com",
    softwareLabel:"البرنامج",
    workflowLabel:"صف سير عملك",
    workflowPh:   "ما الذي تفعله يدوياً الآن ويبطئك؟ صف المهمة المتكررة أو العملية.",
    automateLabel:"ماذا يجب أن تفعل الأداة؟",
    automatePh:   "ما الذي يجب أن تؤتمته أو تحله الأداة تحديداً؟ كن محدداً قدر الإمكان.",
    timelineLabel:"الجدول الزمني",
    timelinePh:   "اختر الجدول الزمني",
    budgetLabel:  "نطاق الميزانية",
    budgetPh:     "اختر ميزانيتك",
    notesLabel:   "ملاحظات إضافية (اختياري)",
    notesPh:      "أي مراجع أو إلهامات أو قيود تقنية يجب معرفتها؟",
    submit:       "إرسال طلب الأداة",
    sending:      "جارٍ الإرسال…",
    successTitle: "تم استلام طلبك!",
    successMsg:   "سنراجع طلبك ونرد عليك خلال 48 ساعة بتقييم الجدوى وعرض السعر.",
    errorPrefix:  "حدث خطأ:",
    required:     "يرجى ملء جميع الحقول المطلوبة.",
    timelines:    ["عاجل (rush)", "خلال شهر واحد", "2-3 أشهر", "مرن / لا توجد عجلة"],
    budgets:      ["أقل من 500 $", "500 $ – 1,500 $", "1,500 $ – 5,000 $", "5,000 $+", "للنقاش"],
    softwares:    ["After Effects", "Premiere Pro", "DaVinci Resolve", "Cinema 4D", "Blender", "أخرى"],
  },
};

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

type Phase = "form" | "sending" | "success" | "error";

export function CustomToolRequestModal({ open, onClose }: Props) {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith("ar") ? "ar" : i18n.language?.startsWith("fr") ? "fr" : "en";
  const T = MODAL_I18N[lang] || MODAL_I18N.en;
  const isRtl = lang === "ar";

  const [phase,    setPhase]    = useState<Phase>("form");
  const [errorMsg, setErrorMsg] = useState("");

  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [softwares, setSoftwares] = useState<string[]>([]);
  const [workflow,  setWorkflow]  = useState("");
  const [automate,  setAutomate]  = useState("");
  const [timeline,  setTimeline]  = useState("");
  const [budget,    setBudget]    = useState("");
  const [notes,     setNotes]     = useState("");

  const toggleSoftware = (s: string) =>
    setSoftwares(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const resetForm = () => {
    setPhase("form"); setErrorMsg("");
    setName(""); setEmail(""); setSoftwares([]); setWorkflow("");
    setAutomate(""); setTimeline(""); setBudget(""); setNotes("");
  };

  const handleClose = () => { resetForm(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !workflow.trim() || !automate.trim() || !timeline || !budget) {
      setPhase("error");
      setErrorMsg(T.required as string);
      setTimeout(() => setPhase("form"), 2500);
      return;
    }
    setPhase("sending");
    try {
      const res = await fetch(`${API_BASE}/custom-tool-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ name, email, softwares, workflow, automate, timeline, budget, notes }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Unknown error");
      setPhase("success");
    } catch (err) {
      setErrorMsg(String(err));
      setPhase("error");
    }
  };

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all";
  const selectCls = `w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all appearance-none cursor-pointer`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={e => e.stopPropagation()}
            dir={isRtl ? "rtl" : "ltr"}
            className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0e0e12] shadow-2xl shadow-black/60"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#3f3f46 transparent" }}
          >
            {/* Header gradient bar */}
            <div className="sticky top-0 z-10 bg-[#0e0e12] border-b border-white/8 px-6 pt-6 pb-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  {/* Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/25 mb-3">
                    <Wrench className="w-3 h-3 text-purple-400" />
                    <span className="text-xs text-purple-300 font-medium">{T.badge as string}</span>
                  </div>
                  <h2 className="text-xl font-bold text-white leading-tight">{T.title as string}</h2>
                  <p className="text-white/50 text-sm mt-1 leading-relaxed">{T.subtitle as string}</p>
                </div>
                <button
                  onClick={handleClose}
                  className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-6">
              {phase === "success" ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-10"
                >
                  <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-5">
                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{T.successTitle as string}</h3>
                  <p className="text-white/55 text-sm leading-relaxed max-w-sm mx-auto">{T.successMsg as string}</p>
                  <button
                    onClick={handleClose}
                    className="mt-8 px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm transition-all"
                  >
                    Close
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">

                  {/* Name + Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-white/50 font-medium mb-1.5 uppercase tracking-wider">
                        {T.nameLabel as string} <span className="text-purple-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder={T.namePh as string}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 font-medium mb-1.5 uppercase tracking-wider">
                        {T.emailLabel as string} <span className="text-purple-400">*</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder={T.emailPh as string}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {/* Software checkboxes */}
                  <div>
                    <label className="block text-xs text-white/50 font-medium mb-2.5 uppercase tracking-wider">
                      {T.softwareLabel as string}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(T.softwares as string[]).map(sw => {
                        const active = softwares.includes(sw);
                        return (
                          <button
                            key={sw}
                            type="button"
                            onClick={() => toggleSoftware(sw)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              active
                                ? "bg-purple-600/30 border-purple-500/60 text-purple-200"
                                : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/8"
                            }`}
                          >
                            {active && <span className="mr-1">✓</span>}{sw}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Workflow */}
                  <div>
                    <label className="block text-xs text-white/50 font-medium mb-1.5 uppercase tracking-wider">
                      {T.workflowLabel as string} <span className="text-purple-400">*</span>
                    </label>
                    <textarea
                      value={workflow}
                      onChange={e => setWorkflow(e.target.value)}
                      placeholder={T.workflowPh as string}
                      rows={3}
                      className={`${inputCls} resize-none`}
                    />
                  </div>

                  {/* What should it do */}
                  <div>
                    <label className="block text-xs text-white/50 font-medium mb-1.5 uppercase tracking-wider">
                      {T.automateLabel as string} <span className="text-purple-400">*</span>
                    </label>
                    <textarea
                      value={automate}
                      onChange={e => setAutomate(e.target.value)}
                      placeholder={T.automatePh as string}
                      rows={3}
                      className={`${inputCls} resize-none`}
                    />
                  </div>

                  {/* Timeline + Budget */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative">
                      <label className="block text-xs text-white/50 font-medium mb-1.5 uppercase tracking-wider">
                        {T.timelineLabel as string} <span className="text-purple-400">*</span>
                      </label>
                      <select
                        value={timeline}
                        onChange={e => setTimeline(e.target.value)}
                        className={selectCls}
                      >
                        <option value="" disabled className="bg-gray-900">{T.timelinePh as string}</option>
                        {(T.timelines as string[]).map(t => (
                          <option key={t} value={t} className="bg-gray-900">{t}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-[2.35rem] w-4 h-4 text-white/30 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <label className="block text-xs text-white/50 font-medium mb-1.5 uppercase tracking-wider">
                        {T.budgetLabel as string} <span className="text-purple-400">*</span>
                      </label>
                      <select
                        value={budget}
                        onChange={e => setBudget(e.target.value)}
                        className={selectCls}
                      >
                        <option value="" disabled className="bg-gray-900">{T.budgetPh as string}</option>
                        {(T.budgets as string[]).map(b => (
                          <option key={b} value={b} className="bg-gray-900">{b}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-[2.35rem] w-4 h-4 text-white/30 pointer-events-none" />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs text-white/50 font-medium mb-1.5 uppercase tracking-wider">
                      {T.notesLabel as string}
                    </label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder={T.notesPh as string}
                      rows={2}
                      className={`${inputCls} resize-none`}
                    />
                  </div>

                  {/* Error */}
                  {phase === "error" && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{T.errorPrefix as string} {errorMsg}</span>
                    </motion.div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={phase === "sending"}
                    className="w-full relative overflow-hidden rounded-xl py-3.5 font-semibold text-sm text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {phase === "sending"
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> {T.sending as string}</>
                        : T.submit as string
                      }
                    </span>
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}