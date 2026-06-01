import { Link, useLocation, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { NeonButton } from "../shared/NeonButton";
import { UserAuthModal } from "../shared/UserAuthModal";
import { LanguageSwitcher } from "../shared/LanguageSwitcher";
import { useUserAuth } from "../../hooks/useUserAuth";
import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect } from "react";
import { X, User, KeyRound, LogOut } from "lucide-react";
import { useLogo } from "../../context/LogoContext";

export function Header() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { t }     = useTranslation();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen,  setAuthModalOpen]  = useState(false);
  const [userMenuOpen,   setUserMenuOpen]   = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { activeLogoUrl, logoText, logoHeight } = useLogo();

  const { user, loading, signInWithEmail, signUpWithEmail, forgotPassword, signInWithOAuth, signOut } = useUserAuth();

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { label: t('nav.home'),     path: "/" },
    { label: t('nav.projects'), path: "/projects" },
    { label: t('nav.tools'),    path: "/tools" },
    { label: t('nav.about'),    path: "/about" },
  ];

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
    navigate('/tools');
  };

  const avatarUrl   = user?.user_metadata?.avatar_url;
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '';
  const initials    = displayName.slice(0, 2).toUpperCase();

  return (
    <>
      <header
        className="sticky top-0 z-50 backdrop-blur-2xl border-b border-white/5"
        style={{ backgroundColor: 'var(--fastoosh-header-bg, rgba(0,0,0,0.10))' }}
      >
        <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between rtl:flex-row-reverse">
          {/* Logo */}
          <Link to="/" onClick={() => setMobileMenuOpen(false)}>
            <motion.div
              className="tracking-tight"
              whileHover={!reduceMotion ? { scale: 1.05 } : undefined}
            >
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
            </motion.div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 rtl:flex-row-reverse">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  data-active={isActive ? 'true' : 'false'}
                  className="fastoosh-nav-link relative px-4 py-2 transition-colors"
                >
                  <span className="relative z-10">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 bg-white/10 rounded-lg"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Desktop right side */}
          <div className="hidden md:flex items-center gap-3 rtl:flex-row-reverse">
            {/* Language switcher */}
            <LanguageSwitcher variant="compact" />

            {!loading && (
              <>
                {user ? (
                  /* User avatar + dropdown */
                  <div className="relative" ref={userMenuRef}>
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-1.5 pl-1 pr-3 py-0.5 rounded-full
                        border border-white/10 hover:border-purple-500/40
                        hover:bg-purple-500/10 transition-all group"
                      style={{ backgroundColor: 'var(--fastoosh-signin-bg, rgba(255,255,255,0.05))' }}
                      aria-label={t('nav.myAccount')}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={displayName} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-300 text-[10px] font-bold">
                          {initials}
                        </div>
                      )}
                      <span className="fastoosh-nav-link text-xs max-w-24 truncate">{displayName}</span>
                    </button>

                    {/* Dropdown */}
                    <AnimatePresence>
                      {userMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 rtl:right-auto rtl:left-0 top-full mt-2 w-52 rounded-xl
                            bg-black/95 backdrop-blur-xl border border-white/10
                            shadow-2xl shadow-black/60 overflow-hidden z-50"
                        >
                          <div className="px-4 py-3 border-b border-white/8">
                            <p className="text-white font-semibold text-sm truncate">{displayName}</p>
                            <p className="text-white/40 text-xs truncate">{user.email}</p>
                          </div>
                          <div className="py-1">
                            <Link
                              to="/account"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-3 rtl:flex-row-reverse px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                            >
                              <KeyRound className="w-4 h-4" />
                              {t('nav.myLicenses', { defaultValue: 'My Licenses' })}
                            </Link>
                            <Link
                              to="/account"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-3 rtl:flex-row-reverse px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                            >
                              <User className="w-4 h-4" />
                              {t('nav.myAccount')}
                            </Link>
                            <button
                              onClick={handleSignOut}
                              className="w-full flex items-center gap-3 rtl:flex-row-reverse px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
                            >
                              <LogOut className="w-4 h-4" />
                              {t('nav.signOut')}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  /* Sign in button */
                  <button
                    onClick={() => setAuthModalOpen(true)}
                    className="flex items-center gap-2 rtl:flex-row-reverse px-4 py-2 rounded-xl
                      border border-white/10 hover:border-purple-500/40
                      fastoosh-nav-link text-sm
                      hover:bg-purple-500/10 transition-all"
                    style={{ backgroundColor: 'var(--fastoosh-signin-bg, rgba(255,255,255,0.05))' }}
                  >
                    <User className="w-4 h-4" />
                    {t('nav.signIn')}
                  </button>
                )}
              </>
            )}
            <NeonButton
              href="/work-with-us"
              // Header-sized: override NeonButton's default px-8 py-4 with
              // tighter padding + smaller text so it sits in scale with the
              // language switcher and user menu next to it.
              className="!px-4 !py-1.5 !rounded-lg text-sm"
            >
              {t('nav.workWithUs')}
            </NeonButton>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </nav>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-white/5 backdrop-blur-2xl"
            style={{ backgroundColor: 'var(--fastoosh-header-bg, rgba(0,0,0,0.70))' }}
          >
            <div className="px-6 py-4 space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  data-active={location.pathname === item.path ? 'true' : 'false'}
                  className="fastoosh-nav-link block py-2 transition-colors text-start"
                >
                  {item.label}
                </Link>
              ))}

              {/* Mobile language switcher */}
              <div className="pt-1 pb-1 border-t border-white/8">
                <LanguageSwitcher variant="full" />
              </div>

              {/* Mobile auth */}
              <div className="pt-2 space-y-3 border-t border-white/8">
                {user ? (
                  <>
                    <Link
                      to="/account"
                      onClick={() => setMobileMenuOpen(false)}
                      className="fastoosh-nav-link flex items-center gap-2 rtl:flex-row-reverse py-2 transition-colors"
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={displayName} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <User className="w-5 h-5" />
                      )}
                      {t('nav.myAccount')}
                    </Link>
                    <button
                      onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}
                      className="flex items-center gap-2 rtl:flex-row-reverse py-2 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('nav.signOut')}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setAuthModalOpen(true); setMobileMenuOpen(false); }}
                    className="fastoosh-nav-link flex items-center gap-2 rtl:flex-row-reverse py-2 transition-colors"
                  >
                    <User className="w-5 h-5" />
                    {t('nav.signIn')}
                  </button>
                )}
              </div>
              <div className="pt-2">
                <NeonButton href="/work-with-us" className="w-full justify-center">
                  {t('nav.workWithUs')}
                </NeonButton>
              </div>
            </div>
          </motion.div>
        )}
      </header>

      {/* Auth modal */}
      {authModalOpen && (
        <UserAuthModal
          onClose={() => setAuthModalOpen(false)}
          onSignInEmail={signInWithEmail}
          onSignUpEmail={signUpWithEmail}
          onForgotPassword={forgotPassword}
          onSignInOAuth={signInWithOAuth}
        />
      )}
    </>
  );
}