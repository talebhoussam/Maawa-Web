import '@/app/admin.css';
import ScopeRoot from '@/components/ScopeRoot';
import AdminToast from '@/components/admin/AdminToast';

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ScopeRoot scope="maawa-admin-root">
      {children}
      <AdminToast />
    </ScopeRoot>
  );
}
