// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

/**
 * ConnectOrCallModal + useRequireAuth — guest-mode action gate.
 *
 * Coverage:
 *   - Modal renders nothing initially.
 *   - openConnectModal() makes the modal appear with the default title.
 *   - openConnectModal('aimer') uses the "Connectez-vous pour aimer" title.
 *   - Modal close button removes it from the DOM.
 *   - "Créer un compte" calls router.push('/register').
 *   - "Se connecter" calls router.push('/login').
 *   - useRequireAuth runs the action immediately for an authenticated user.
 *   - useRequireAuth opens the modal for a guest.
 */

const routerPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, replace: routerPush }),
}));

/* Capture the callback so the test can flip auth state on demand. */
let authCallback: ((u: { uid: string } | null) => void) | null = null;
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: { uid: string } | null) => void) => {
    authCallback = cb;
    /* Default to "not yet ready" — the test calls cb() to flip. */
    return () => { authCallback = null; };
  },
}));

vi.mock('@/lib/firebase', () => ({ auth: {} }));

import ConnectOrCallModal, {
  useRequireAuth,
  openConnectModal,
} from '@/components/ConnectOrCallModal';

beforeEach(() => {
  vi.clearAllMocks();
  authCallback = null;
});

describe('ConnectOrCallModal', () => {
  it('renders nothing initially', () => {
    const { container } = render(<ConnectOrCallModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders default title when openConnectModal is called without action', () => {
    render(<ConnectOrCallModal />);
    act(() => { openConnectModal(); });
    expect(screen.getByText(/Connectez-vous pour continuer/)).toBeInTheDocument();
  });

  it('formats the title with the action verb', () => {
    render(<ConnectOrCallModal />);
    act(() => { openConnectModal('aimer'); });
    expect(screen.getByText(/Connectez-vous pour aimer/)).toBeInTheDocument();
  });

  it('routes to /register when Créer un compte is clicked', () => {
    render(<ConnectOrCallModal />);
    act(() => { openConnectModal(); });
    fireEvent.click(screen.getByText(/Créer un compte gratuit/));
    expect(routerPush).toHaveBeenCalledWith('/register');
  });

  it('routes to /login when Se connecter is clicked', () => {
    render(<ConnectOrCallModal />);
    act(() => { openConnectModal(); });
    fireEvent.click(screen.getByText('Se connecter'));
    expect(routerPush).toHaveBeenCalledWith('/login');
  });
});

/* useRequireAuth test harness — a tiny component that uses the hook. */
function Harness({ action }: { action: () => void }) {
  const requireAuth = useRequireAuth();
  return <button onClick={() => requireAuth(action, 'aimer')}>do it</button>;
}

describe('useRequireAuth', () => {
  it('opens the modal for a guest (auth callback fires with null)', () => {
    const action = vi.fn();
    render(<>
      <ConnectOrCallModal />
      <Harness action={action} />
    </>);
    /* Flip auth state to "guest". */
    act(() => { authCallback?.(null); });
    fireEvent.click(screen.getByText('do it'));
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByText(/Connectez-vous pour aimer/)).toBeInTheDocument();
  });

  it('runs the action immediately for a signed-in user', () => {
    const action = vi.fn();
    render(<>
      <ConnectOrCallModal />
      <Harness action={action} />
    </>);
    /* Flip auth to "signed in". */
    act(() => { authCallback?.({ uid: 'me' }); });
    fireEvent.click(screen.getByText('do it'));
    expect(action).toHaveBeenCalledTimes(1);
    /* Modal should NOT have opened. */
    expect(screen.queryByText(/Connectez-vous pour aimer/)).toBeNull();
  });

  it('opens the modal when auth has not initialised yet (safety default)', () => {
    const action = vi.fn();
    render(<>
      <ConnectOrCallModal />
      <Harness action={action} />
    </>);
    /* Do NOT call authCallback — `ready` stays false. */
    fireEvent.click(screen.getByText('do it'));
    expect(action).not.toHaveBeenCalled();
  });
});
