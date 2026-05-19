/**
 * /seed/accounts
 *
 * Development-only helper. Originally created hardcoded test accounts
 * including one with role='admin' — that's been removed because
 * granting admin from the browser is a privilege escalation.
 *
 * For admin bootstrap, use:
 *   npm run admin:bootstrap -- <uid>
 *
 * For test client/artisan accounts, register via the public /register
 * page; for artisan role specifically, then approve their application
 * via /admin/applications.
 */

import Link from 'next/link';

export default function SeedAccountsRedirect() {
  return (
    <div style={{ padding: 40, maxWidth: 640, margin: '0 auto', fontFamily: 'monospace', color: '#fff', background: '#0a0a12', minHeight: '100vh' }}>
      <h1 style={{ color: '#29B6F6' }}>🔒 Seed Accounts disabled</h1>
      <p style={{ lineHeight: 1.6 }}>
        The legacy <code>/seed/accounts</code> tool created users with hardcoded
        passwords and assigned the <code>admin</code> role from the browser.
        That path is closed because it allowed any user reaching this page to
        promote themselves.
      </p>
      <h2 style={{ marginTop: 24, color: '#fff' }}>Replacement workflows</h2>
      <ul style={{ lineHeight: 1.8 }}>
        <li>
          <strong>Create the first admin:</strong>{' '}
          <code>npm run admin:bootstrap -- &lt;uid&gt;</code>{' '}
          (uses the Admin SDK directly, bypasses public auth).
        </li>
        <li>
          <strong>Promote an existing user to admin:</strong> sign in as a super-admin
          and POST <code>/api/admin/users/promote</code>.
        </li>
        <li>
          <strong>Create test client accounts:</strong>{' '}
          <Link href="/register" style={{ color: '#29B6F6' }}>register normally</Link>.
        </li>
        <li>
          <strong>Test artisan accounts:</strong> register, then submit an application
          via <Link href="/apply" style={{ color: '#29B6F6' }}>/apply</Link>, then
          approve it in <Link href="/admin/applications" style={{ color: '#29B6F6' }}>
          the admin panel</Link>.
        </li>
      </ul>
    </div>
  );
}
