import { motion } from "motion/react";
import { useState } from "react";
import { GlassCard } from "../components/shared/GlassCard";
import { NeonButton } from "../components/shared/NeonButton";
import { CheckCircle2, Mail, Clock, Shield, Loader2 } from "lucide-react";
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

const projectTypes = [
  "Product explainer",
  "Brand identity",
  "UI/UX animations",
  "Social media campaign",
  "Full production",
  "Other"
];

const timelines = [
  "ASAP (rush)",
  "1-2 weeks",
  "2-4 weeks",
  "1-2 months",
  "Flexible"
];

const budgetRanges = [
  "$5k - $10k",
  "$10k - $25k",
  "$25k - $50k",
  "$50k+",
  "Not sure yet"
];

export function WorkWithUs() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    projectType: "",
    timeline: "",
    budget: "",
    message: ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: '' });

    try {
      const response = await fetch(`${API_BASE}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setSubmitStatus({
          type: 'success',
          message: result.message || "Thanks! We'll reply within 24-48 hours.",
        });
        // Reset form
        setFormData({
          name: "",
          email: "",
          projectType: "",
          timeline: "",
          budget: "",
          message: ""
        });
      } else {
        console.error('Server error:', result.error);
        setSubmitStatus({
          type: 'error',
          message: result.error || 'Failed to send message. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitStatus({
        type: 'error',
        message: 'An unexpected error occurred. Please try again or contact us directly at youssef@fastoosh.com',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
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
            Tell us about your project. We typically reply within 24-48 hours.
          </p>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left: What happens next */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-8"
          >
            <div>
              <h2 className="text-3xl mb-8">What happens next</h2>
              
              <div className="space-y-6">
                <GlassCard className="p-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                      1
                    </div>
                    <div>
                      <h3 className="text-lg mb-2">We review your project</h3>
                      <p className="text-white/60 text-sm">
                        Our team reviews your brief and checks availability
                      </p>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="p-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                      2
                    </div>
                    <div>
                      <h3 className="text-lg mb-2">Discovery call</h3>
                      <p className="text-white/60 text-sm">
                        30-minute video call to discuss scope, timeline, and budget
                      </p>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="p-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                      3
                    </div>
                    <div>
                      <h3 className="text-lg mb-2">Detailed proposal</h3>
                      <p className="text-white/60 text-sm">
                        We send a comprehensive proposal with timeline and pricing
                      </p>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="p-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                      4
                    </div>
                    <div>
                      <h3 className="text-lg mb-2">Kickoff</h3>
                      <p className="text-white/60 text-sm">
                        Sign the contract and start creating amazing work together
                      </p>
                    </div>
                  </div>
                </GlassCard>
              </div>
            </div>

            {/* Reassurance */}
            <GlassCard className="p-8 bg-white/[0.02]">
              <h3 className="text-xl mb-6">Why teams choose us</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium mb-1">Fast response time</div>
                    <p className="text-white/60 text-sm">We reply within 24-48 hours, every time</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium mb-1">NDA-friendly</div>
                    <p className="text-white/60 text-sm">Happy to sign NDAs before discussing details</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium mb-1">Remote worldwide</div>
                    <p className="text-white/60 text-sm">We work across all timezones seamlessly</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium mb-1">Clear pricing</div>
                    <p className="text-white/60 text-sm">Transparent quotes, no hidden fees</p>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Contact info */}
            <div className="flex items-center gap-4 text-white/60">
              <Mail className="w-5 h-5" />
              <div>
                <div className="text-sm">Or email us directly</div>
                <a href="mailto:youssef@fastoosh.com" className="text-white hover:text-purple-400 transition-colors">
                  youssef@fastoosh.com
                </a>
              </div>
            </div>
          </motion.div>

          {/* Right: Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <GlassCard neonBorder className="p-8 sticky top-24">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm mb-2">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="Your name"
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm mb-2">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="your@email.com"
                  />
                </div>

                {/* Project Type */}
                <div>
                  <label htmlFor="projectType" className="block text-sm mb-2">
                    Project type
                  </label>
                  <select
                    id="projectType"
                    name="projectType"
                    value={formData.projectType}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  >
                    <option value="" className="bg-gray-900">Select a type</option>
                    {projectTypes.map((type) => (
                      <option key={type} value={type} className="bg-gray-900">
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Timeline */}
                <div>
                  <label htmlFor="timeline" className="block text-sm mb-2">
                    Timeline
                  </label>
                  <select
                    id="timeline"
                    name="timeline"
                    value={formData.timeline}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  >
                    <option value="" className="bg-gray-900">Select timeline</option>
                    {timelines.map((time) => (
                      <option key={time} value={time} className="bg-gray-900">
                        {time}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Budget */}
                <div>
                  <label htmlFor="budget" className="block text-sm mb-2">
                    Budget range
                  </label>
                  <select
                    id="budget"
                    name="budget"
                    value={formData.budget}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  >
                    <option value="" className="bg-gray-900">Select budget</option>
                    {budgetRanges.map((range) => (
                      <option key={range} value={range} className="bg-gray-900">
                        {range}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-sm mb-2">
                    Tell us about your project <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
                    placeholder="Describe your project goals, target audience, and any specific requirements..."
                  />
                </div>

                {/* Microcopy */}
                <div className="text-sm text-white/50 leading-relaxed">
                  <p>
                    <strong className="text-white/70">Reply in 24-48h</strong> • 
                    <strong className="text-white/70"> NDA-friendly</strong> • 
                    <strong className="text-white/70"> Remote worldwide</strong>
                  </p>
                  <p className="mt-2">
                    Mention deadlines if urgent.
                  </p>
                </div>

                {/* Submit */}
                <NeonButton type="submit" className="w-full justify-center" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    'Send message'
                  )}
                </NeonButton>
                {submitStatus.type && (
                  <div className={`mt-2 text-sm ${submitStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {submitStatus.message}
                  </div>
                )}
              </form>
            </GlassCard>
          </motion.div>
        </div>

        {/* Optional Book a Call */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-24 text-center"
        >
          <GlassCard className="p-8 inline-block">
            <Clock className="w-8 h-8 text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl mb-2">Prefer to book a call directly?</h3>
            <p className="text-white/60 mb-4 text-sm">Schedule a 30-minute discovery call</p>
            <NeonButton variant="secondary">Book a call</NeonButton>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}