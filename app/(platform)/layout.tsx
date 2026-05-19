import '@/app/platform.css';
import ScopeRoot from '@/components/ScopeRoot';
import I18nApplier from '@/components/I18nApplier';
import Topbar from '@/components/platform/Topbar';
import PushBanner from '@/components/platform/PushBanner';
import Sidebar from '@/components/platform/Sidebar';
import BottomNav from '@/components/platform/BottomNav';
import Toast from '@/components/platform/Toast';
import ArtisanModeWatcher from '@/components/platform/ArtisanModeWatcher';
import TenderModal from '@/components/platform/modals/TenderModal';
import CallModal from '@/components/platform/modals/CallModal';
import BookingModal from '@/components/platform/modals/BookingModal';
import RatingModal from '@/components/platform/modals/RatingModal';
import CancelModal from '@/components/platform/modals/CancelModal';
import RechargeModal from '@/components/platform/modals/RechargeModal';
import StoryCreateModal from '@/components/platform/modals/StoryCreateModal';
import ConnectOrCallModal from '@/components/ConnectOrCallModal';

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ScopeRoot scope="maawa-platform-root">
      <ArtisanModeWatcher />
      <I18nApplier scope="platform" />
      <div id="app" className="layer on" style={{ flexDirection: 'column' }}>
        <Topbar />
        <PushBanner />
        <div className="app-body">
          <Sidebar />
          <main className="main-area" id="main" data-screens="true">
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
      <CallModal />
      <BookingModal />
      <TenderModal />
      <RatingModal />
      <CancelModal />
      <RechargeModal />
      <StoryCreateModal />
      <ConnectOrCallModal />
      <Toast />
    </ScopeRoot>
  );
}
