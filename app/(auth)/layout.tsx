import '@/app/platform.css';
import ScopeRoot from '@/components/ScopeRoot';
import I18nApplier from '@/components/I18nApplier';
import AuthTopBar from '@/components/auth/AuthTopBar';
import Toast from '@/components/platform/Toast';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ScopeRoot scope="maawa-platform-root">
      <I18nApplier scope="platform" />
      <div id="auth" className="layer on">
        <div className="auth-orb auth-orb1"></div>
        <div className="auth-orb auth-orb2"></div>
        <AuthTopBar />
        {children}
      </div>
      <Toast />
    </ScopeRoot>
  );
}
