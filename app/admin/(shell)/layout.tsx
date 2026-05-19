import '@/app/admin.css';
import ScopeRoot from '@/components/ScopeRoot';
import I18nApplier from '@/components/I18nApplier';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminTopbar from '@/components/admin/AdminTopbar';
import AdminToast from '@/components/admin/AdminToast';
import UserModal from '@/components/admin/modals/UserModal';
import NinModal from '@/components/admin/modals/NinModal';
import MissionModal from '@/components/admin/modals/MissionModal';
import DisputeModal from '@/components/admin/modals/DisputeModal';
import CatModal from '@/components/admin/modals/CatModal';
import CreateArtisanModal from '@/components/admin/modals/CreateArtisanModal';
import RejectAppModal from '@/components/admin/modals/RejectAppModal';
import AssignModal from '@/components/admin/modals/AssignModal';
import BookingDetailModal from '@/components/admin/modals/BookingDetailModal';
import CreateAdminModal from '@/components/admin/modals/CreateAdminModal';
import ManageAdminModal from '@/components/admin/modals/ManageAdminModal';
import CreateAdModal from '@/components/admin/modals/CreateAdModal';
import PerfModal from '@/components/admin/modals/PerfModal';
import ContentModal from '@/components/admin/modals/ContentModal';
import BroadcastPreviewModal from '@/components/admin/modals/BroadcastPreviewModal';
import PayoutConfirmModal from '@/components/admin/modals/PayoutConfirmModal';
import BanConfirmModal from '@/components/admin/modals/BanConfirmModal';
import AdminAuthGuard from '@/components/AdminAuthGuard';

export default function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthGuard>
      <ScopeRoot scope="maawa-admin-root">
        <I18nApplier scope="admin" />
        <div id="admin-wrap" className="on">
          <div className="sb-overlay" id="sb-overlay"></div>
          <AdminSidebar />
          <div className="main-wrap">
            <AdminTopbar />
            <main className="content" id="content">
              {children}
            </main>
          </div>
        </div>
      {/* Modals — rendered hidden, openModal('id') toggles `on` class */}
      <UserModal />
      <NinModal />
      <MissionModal />
      <DisputeModal />
      <CatModal />
      <CreateArtisanModal />
      <RejectAppModal />
      <AssignModal />
      <BookingDetailModal />
      <CreateAdminModal />
      <ManageAdminModal />
      <CreateAdModal />
      <PerfModal />
      <ContentModal />
      <BroadcastPreviewModal />
      <PayoutConfirmModal />
      <BanConfirmModal />
      <AdminToast />
    </ScopeRoot>
    </AdminAuthGuard>
  );
}
