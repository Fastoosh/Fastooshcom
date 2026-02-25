import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { InlineWidget } from "react-calendly";
import { GlassCard } from "../components/shared/GlassCard";
import { NeonButton } from "../components/shared/NeonButton";
import { SeoHead } from "../components/shared/SeoHead";
import {
  CheckCircle2,
  Mail,
  Clock,
  Calendar,
  FileText,
  ArrowRight,
  ChevronLeft,
  Loader2,
  Shield,
  Globe,
  Zap,
  MessageSquare,
} from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

const projectTypes = [
  "Product explainer",
  "Brand identity",
  "UI/UX animations",
  "Social media campaign",
  "Full production",
  "Other",
];

const budgetRanges = [
  "$5k – $10k",
  "$10k – $25k",
  "$25k – $50k",
  "$50k+",
  "Not sure yet",
];

const timelines = [
  "ASAP (rush)",
  "1–2 weeks",
  "2–4 weeks",
  "1–2 months",
  "Flexible",
];

// ─── Process steps ────────────────────────────────────────────────────────────
const callSteps = [
  {
    n: "1",
    title: "Quick pre-screen",
    body: "Tell us your name, email, and a bit about your project so we show up prepared.",
  },
  {
    n: "2",
    title: "Pick a time slot",
    body: "Choose any 30-minute slot that works in your timezone — no back-and-forth emails.",
  },
  {
    n: "3",
    title: "Discovery call",
    body: "We discuss scope, goals, and timeline live. You leave with full clarity.",
  },
  {
    n: "4",
    title: "Tailored proposal",
    body: "Within 48 h of the call we send a detailed proposal with pricing and next steps.",
  },
];

const briefSteps = [
  {
    n: "1",
    title: "Fill the brief",
    body: "Share your project type, budget range, timeline, and description — takes 3 minutes.",
  },
  {
    n: "2",
    title: "We review it",
    body: "Our team reads your brief and checks availability — reply within 24–48 h.",
  },
  {
    n: "3",
    title: "Discovery call",
    body: "We follow up with a call invitation to go deeper on scope and strategy.",
  },
  {
    n: "4",
    title: "Tailored proposal",
    body: "You receive a comprehensive proposal with timeline, deliverables, and pricing.",
  },
];

type Path = "choose" | "call" | "brief";
type CallStage = "prescreen" | "calendly";

export function WorkWithUs() {
  // ── Calendly URL from settings ──────────────────────────────────────────────
  const [calendlyUrl, setCalendlyUrl] = useState<string>("");
  const [calendlyLoading, setCalendlyLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/settings`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then((r) => r.json())
      .then((res) => {
        const url = res.data?.calendlyUrl || "";
        setCalendlyUrl(url);
      })
      .catch((err) => console.error("Failed to load Calendly URL:", err))
      .finally(() => setCalendlyLoading(false));
  }, []);

  // ── Path state ──────────────────────────────────────────────────────────────
  const [path, setPath] = useState<Path>("choose");

  // ── Call pre-screen ─────────────────────────────────────────────────────────
  const [callStage, setCallStage] = useState<CallStage>("prescreen");
  const [prescreen, setPrescreen] = useState({
    name: "",
    email: "",
    projectType: "",
    budget: "",
  });

  // ── Brief form ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    projectType: "",
    timeline: "",
    budget: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handlePrescreenChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setPrescreen({ ...prescreen, [e.target.name]: e.target.value });

  const handlePrescreenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCallStage("calendly");
  };

  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });
    try {
      const res = await fetch(`${API_BASE}/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (result.success) {
        setSubmitStatus({
          type: "success",
          message: result.message || "Thanks! We'll reply within 24–48 hours.",
        });
        setFormData({
          name: "",
          email: "",
          projectType: "",
          timeline: "",
          budget: "",
          message: "",
        });
      } else {
        console.error("Server error:", result.error);
        setSubmitStatus({
          type: "error",
          message: result.error || "Failed to send. Please try again.",
        });
      }
    } catch (err) {
      console.error("Form submit error:", err);
      setSubmitStatus({
        type: "error",
        message:
          "An unexpected error occurred. Try again or email youssef@fastoosh.com directly.",
      });
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

  // ── Input class helper ───────────────────────────────────────────────────────
  const inputCls =
    "w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all";

  return (
    <div className="min-h-screen py-24 px-6">
      <SeoHead
        pageKey="work-with-us"
        fallback={{
          title: "Work With Us — Hire Fastoosh Motion Design Studio",
          description:
            "Book a discovery call or send a project brief. Premium motion design for brands worldwide.",
        }}
      />

      <div className="max-w-6xl mx-auto">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl tracking-tight mb-6">
            Let's create something
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              extraordinary
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto">
            Choose how you'd like to start — a live call or a written brief.
            Either way, we'll build something great together.
          </p>
        </motion.div>

        {/* ── Path chooser (full-width, shown before selection) ────────────── */}
        <AnimatePresence mode="wait">
          {path === "choose" && (
            <motion.div
              key="chooser"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20"
            >
              {/* Book a Call card */}
              <motion.button
                onClick={() => setPath("call")}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.25 }}
                className="text-left group"
              >
                <GlassCard
                  neonBorder
                  className="p-8 h-full cursor-pointer group-hover:shadow-[0_0_50px_rgba(168,85,247,0.25)] transition-shadow duration-300"
                >
                  <div className="flex flex-col h-full gap-6">
                    {/* Icon */}
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-500/30 flex items-center justify-center">
                      <Calendar className="w-7 h-7 text-purple-400" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h2 className="text-2xl">Book a discovery call</h2>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                          Recommended
                        </span>
                      </div>
                      <p className="text-white/60 leading-relaxed mb-6">
                        30-minute live conversation — we'll discuss your vision,
                        goals, and scope before anything else. The fastest path
                        to a great project.
                      </p>
                      <ul className="space-y-2">
                        {[
                          "Pick any available time slot",
                          "We show up prepared for your project",
                          "Get a tailored proposal within 48 h",
                        ].map((item) => (
                          <li
                            key={item}
                            className="flex items-center gap-2 text-sm text-white/70"
                          >
                            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex items-center gap-2 text-purple-400 font-medium text-sm group-hover:gap-3 transition-all duration-200">
                      Schedule a call
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </GlassCard>
              </motion.button>

              {/* Send a Brief card */}
              <motion.button
                onClick={() => setPath("brief")}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.25 }}
                className="text-left group"
              >
                <GlassCard className="p-8 h-full cursor-pointer border-white/10 group-hover:border-white/20 group-hover:shadow-[0_0_50px_rgba(59,130,246,0.15)] transition-all duration-300">
                  <div className="flex flex-col h-full gap-6">
                    {/* Icon */}
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
                      <FileText className="w-7 h-7 text-blue-400" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h2 className="text-2xl">Send a project brief</h2>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-white/50 border border-white/10 font-medium">
                          Async
                        </span>
                      </div>
                      <p className="text-white/60 leading-relaxed mb-6">
                        Prefer to write it out first? Fill a short brief and
                        we'll reply within 24–48 hours with questions or a call
                        invitation.
                      </p>
                      <ul className="space-y-2">
                        {[
                          "Takes about 3 minutes to complete",
                          "Works across all timezones",
                          "We reply within 24–48 hours",
                        ].map((item) => (
                          <li
                            key={item}
                            className="flex items-center gap-2 text-sm text-white/70"
                          >
                            <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex items-center gap-2 text-blue-400 font-medium text-sm group-hover:gap-3 transition-all duration-200">
                      Fill the brief
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </GlassCard>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Two-column layout (shown after path selection) ───────────────── */}
        <AnimatePresence mode="wait">
          {path !== "choose" && (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12"
            >
              {/* ── Left column: process + trust ────────────────────────── */}
              <div className="space-y-8">
                {/* Back button */}
                <button
                  onClick={resetPath}
                  className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Choose a different path
                </button>

                {/* Active path label */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      path === "call"
                        ? "bg-purple-500/20 border border-purple-500/30"
                        : "bg-blue-500/20 border border-blue-500/30"
                    }`}
                  >
                    {path === "call" ? (
                      <Calendar
                        className={`w-5 h-5 ${
                          path === "call" ? "text-purple-400" : "text-blue-400"
                        }`}
                      />
                    ) : (
                      <FileText className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <h2 className="text-2xl">
                    {path === "call"
                      ? "Book a discovery call"
                      : "Send a project brief"}
                  </h2>
                </div>

                {/* Process steps */}
                <div className="space-y-4">
                  {activeSteps.map((step, i) => (
                    <motion.div
                      key={step.n}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.08 }}
                    >
                      <GlassCard className="p-5">
                        <div className="flex gap-4">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${
                              path === "call"
                                ? "bg-gradient-to-br from-purple-500 to-blue-500"
                                : "bg-gradient-to-br from-blue-500 to-cyan-500"
                            }`}
                          >
                            {step.n}
                          </div>
                          <div>
                            <h3 className="text-base font-medium mb-1">
                              {step.title}
                            </h3>
                            <p className="text-white/55 text-sm leading-relaxed">
                              {step.body}
                            </p>
                          </div>
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))}
                </div>

                {/* Trust signals */}
                <GlassCard className="p-6 bg-white/[0.02]">
                  <h3 className="text-lg mb-5">Why teams choose Fastoosh</h3>
                  <div className="space-y-4">
                    {[
                      {
                        icon: Zap,
                        color: "text-yellow-400",
                        title: "Fast response",
                        body: "We reply within 24–48 h, every time",
                      },
                      {
                        icon: Shield,
                        color: "text-green-400",
                        title: "NDA-friendly",
                        body: "Happy to sign NDAs before discussing details",
                      },
                      {
                        icon: Globe,
                        color: "text-blue-400",
                        title: "Remote worldwide",
                        body: "We work seamlessly across all timezones",
                      },
                      {
                        icon: MessageSquare,
                        color: "text-purple-400",
                        title: "Clear pricing",
                        body: "Transparent quotes, zero hidden fees",
                      },
                    ].map(({ icon: Icon, color, title, body }) => (
                      <div key={title} className="flex items-start gap-3">
                        <Icon
                          className={`w-5 h-5 mt-0.5 flex-shrink-0 ${color}`}
                        />
                        <div>
                          <div className="font-medium text-sm mb-0.5">
                            {title}
                          </div>
                          <p className="text-white/55 text-xs">{body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                {/* Direct email */}
                <div className="flex items-center gap-3 text-white/50">
                  <Mail className="w-4 h-4" />
                  <div>
                    <div className="text-xs mb-0.5">Or email us directly</div>
                    <a
                      href="mailto:youssef@fastoosh.com"
                      className="text-white/80 hover:text-purple-400 transition-colors text-sm"
                    >
                      youssef@fastoosh.com
                    </a>
                  </div>
                </div>
              </div>

              {/* ── Right column: form / calendly ────────────────────────── */}
              <div>
                <AnimatePresence mode="wait">
                  {/* ── CALL: pre-screen ──────────────────────────────── */}
                  {path === "call" && callStage === "prescreen" && (
                    <motion.div
                      key="prescreen"
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.4 }}
                    >
                      <GlassCard neonBorder className="p-8">
                        <div className="flex items-center gap-3 mb-2">
                          <Clock className="w-5 h-5 text-purple-400" />
                          <h3 className="text-xl">Quick pre-screen</h3>
                        </div>
                        <p className="text-white/50 text-sm mb-8">
                          Just 4 fields — so we can show up to the call
                          prepared for your specific project.
                        </p>

                        <form
                          onSubmit={handlePrescreenSubmit}
                          className="space-y-5"
                        >
                          {/* Name */}
                          <div>
                            <label className="block text-sm mb-2">
                              Your name{" "}
                              <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              name="name"
                              required
                              value={prescreen.name}
                              onChange={handlePrescreenChange}
                              placeholder="Alex Johnson"
                              className={inputCls}
                            />
                          </div>

                          {/* Email */}
                          <div>
                            <label className="block text-sm mb-2">
                              Work email{" "}
                              <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="email"
                              name="email"
                              required
                              value={prescreen.email}
                              onChange={handlePrescreenChange}
                              placeholder="alex@company.com"
                              className={inputCls}
                            />
                          </div>

                          {/* Project type */}
                          <div>
                            <label className="block text-sm mb-2">
                              Project type
                            </label>
                            <select
                              name="projectType"
                              value={prescreen.projectType}
                              onChange={handlePrescreenChange}
                              className={inputCls}
                            >
                              <option value="" className="bg-gray-900">
                                Select a type
                              </option>
                              {projectTypes.map((t) => (
                                <option
                                  key={t}
                                  value={t}
                                  className="bg-gray-900"
                                >
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Budget */}
                          <div>
                            <label className="block text-sm mb-2">
                              Budget range
                            </label>
                            <select
                              name="budget"
                              value={prescreen.budget}
                              onChange={handlePrescreenChange}
                              className={inputCls}
                            >
                              <option value="" className="bg-gray-900">
                                Select range
                              </option>
                              {budgetRanges.map((r) => (
                                <option
                                  key={r}
                                  value={r}
                                  className="bg-gray-900"
                                >
                                  {r}
                                </option>
                              ))}
                            </select>
                          </div>

                          <NeonButton
                            type="submit"
                            className="w-full justify-center"
                          >
                            Continue to calendar
                            <ArrowRight className="w-4 h-4 ml-1" />
                          </NeonButton>

                          <p className="text-center text-xs text-white/35">
                            Free · No commitment · Cancel anytime
                          </p>
                        </form>
                      </GlassCard>
                    </motion.div>
                  )}

                  {/* ── CALL: Calendly embed ──────────────────────────── */}
                  {path === "call" && callStage === "calendly" && (
                    <motion.div
                      key="calendly"
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.4 }}
                    >
                      <GlassCard neonBorder className="overflow-hidden">
                        {/* Header strip */}
                        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-purple-400" />
                            <div>
                              <div className="text-sm font-medium">
                                Pick your time slot
                              </div>
                              {prescreen.name && (
                                <div className="text-xs text-white/40">
                                  Booked for {prescreen.name}
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setCallStage("prescreen")}
                            className="text-xs text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
                          >
                            <ChevronLeft className="w-3 h-3" />
                            Edit info
                          </button>
                        </div>

                        {/* Calendly widget */}
                        {calendlyLoading ? (
                          <div className="flex items-center justify-center h-[400px]">
                            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                          </div>
                        ) : !calendlyUrl ? (
                          <div className="flex flex-col items-center justify-center h-[400px] gap-4 px-8 text-center">
                            <Calendar className="w-10 h-10 text-white/20" />
                            <p className="text-white/50 text-sm">
                              Calendly URL not configured yet.
                            </p>
                            <p className="text-white/30 text-xs">
                              Go to Admin → Settings → Calendly Booking URL to set it up.
                            </p>
                          </div>
                        ) : (
                        <InlineWidget
                          url={calendlyUrl}
                          prefill={{
                            name: prescreen.name,
                            email: prescreen.email,
                            customAnswers: {
                              a1: prescreen.projectType,
                              a2: prescreen.budget,
                            },
                          }}
                          styles={{ minWidth: "320px", height: "700px" }}
                          pageSettings={{
                            backgroundColor: "040408",
                            hideEventTypeDetails: false,
                            hideLandingPageDetails: false,
                            primaryColor: "a855f7",
                            textColor: "ffffff",
                          }}
                        />
                        )}
                      </GlassCard>
                    </motion.div>
                  )}

                  {/* ── BRIEF: full form ──────────────────────────────── */}
                  {path === "brief" && (
                    <motion.div
                      key="brief-form"
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.4 }}
                    >
                      <GlassCard
                        neonBorder
                        className="p-8 sticky top-24"
                        style={
                          {
                            "--tw-border-opacity": "1",
                          } as React.CSSProperties
                        }
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <FileText className="w-5 h-5 text-blue-400" />
                          <h3 className="text-xl">Project brief</h3>
                        </div>
                        <p className="text-white/50 text-sm mb-8">
                          We'll read your brief carefully and reply within 24–48
                          hours.
                        </p>

                        <form
                          onSubmit={handleFormSubmit}
                          className="space-y-5"
                        >
                          {/* Name */}
                          <div>
                            <label className="block text-sm mb-2">
                              Name <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              name="name"
                              required
                              value={formData.name}
                              onChange={handleFormChange}
                              placeholder="Your name"
                              className={inputCls}
                            />
                          </div>

                          {/* Email */}
                          <div>
                            <label className="block text-sm mb-2">
                              Email <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="email"
                              name="email"
                              required
                              value={formData.email}
                              onChange={handleFormChange}
                              placeholder="your@email.com"
                              className={inputCls}
                            />
                          </div>

                          {/* Project type */}
                          <div>
                            <label className="block text-sm mb-2">
                              Project type
                            </label>
                            <select
                              name="projectType"
                              value={formData.projectType}
                              onChange={handleFormChange}
                              className={inputCls}
                            >
                              <option value="" className="bg-gray-900">
                                Select a type
                              </option>
                              {projectTypes.map((t) => (
                                <option
                                  key={t}
                                  value={t}
                                  className="bg-gray-900"
                                >
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Timeline + Budget row */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm mb-2">
                                Timeline
                              </label>
                              <select
                                name="timeline"
                                value={formData.timeline}
                                onChange={handleFormChange}
                                className={inputCls}
                              >
                                <option value="" className="bg-gray-900">
                                  Select
                                </option>
                                {timelines.map((t) => (
                                  <option
                                    key={t}
                                    value={t}
                                    className="bg-gray-900"
                                  >
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm mb-2">
                                Budget
                              </label>
                              <select
                                name="budget"
                                value={formData.budget}
                                onChange={handleFormChange}
                                className={inputCls}
                              >
                                <option value="" className="bg-gray-900">
                                  Select
                                </option>
                                {budgetRanges.map((r) => (
                                  <option
                                    key={r}
                                    value={r}
                                    className="bg-gray-900"
                                  >
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Message */}
                          <div>
                            <label className="block text-sm mb-2">
                              Tell us about your project{" "}
                              <span className="text-red-400">*</span>
                            </label>
                            <textarea
                              name="message"
                              required
                              rows={5}
                              value={formData.message}
                              onChange={handleFormChange}
                              placeholder="Describe your goals, target audience, and any specific requirements..."
                              className={`${inputCls} resize-none`}
                            />
                          </div>

                          {/* Microcopy */}
                          <p className="text-xs text-white/35 leading-relaxed">
                            <span className="text-white/55 font-medium">
                              24–48 h reply
                            </span>{" "}
                            ·{" "}
                            <span className="text-white/55 font-medium">
                              NDA-friendly
                            </span>{" "}
                            ·{" "}
                            <span className="text-white/55 font-medium">
                              Remote worldwide
                            </span>
                            <br />
                            Mention any deadlines if your timeline is urgent.
                          </p>

                          <NeonButton
                            type="submit"
                            className="w-full justify-center"
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Sending…
                              </>
                            ) : (
                              <>
                                Send brief
                                <ArrowRight className="w-4 h-4 ml-1" />
                              </>
                            )}
                          </NeonButton>

                          {submitStatus.type && (
                            <motion.div
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`text-sm text-center rounded-lg p-3 ${
                                submitStatus.type === "success"
                                  ? "text-green-400 bg-green-500/10 border border-green-500/20"
                                  : "text-red-400 bg-red-500/10 border border-red-500/20"
                              }`}
                            >
                              {submitStatus.message}
                            </motion.div>
                          )}
                        </form>
                      </GlassCard>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bottom CTA (only on choose screen) ──────────────────────────── */}
        <AnimatePresence>
          {path === "choose" && (
            <motion.div
              key="bottom-cta"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center"
            >
              <p className="text-white/40 text-sm mb-2">
                Not sure which to pick?
              </p>
              <p className="text-white/60 text-sm">
                If you have a clear brief ready →{" "}
                <button
                  onClick={() => setPath("brief")}
                  className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
                >
                  send it
                </button>
                . If you'd rather talk first →{" "}
                <button
                  onClick={() => setPath("call")}
                  className="text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
                >
                  book the call
                </button>
                .
              </p>
              <div className="flex items-center justify-center gap-2 mt-8 text-white/35 text-xs">
                <Mail className="w-3.5 h-3.5" />
                Or email directly:{" "}
                <a
                  href="mailto:youssef@fastoosh.com"
                  className="text-white/60 hover:text-purple-400 transition-colors"
                >
                  youssef@fastoosh.com
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
