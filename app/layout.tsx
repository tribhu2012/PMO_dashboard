import './globals.css';
import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Citytech Dashboard',
  description: 'Citytech PM Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(to bottom, #eef2ff, #ffffff)' }}>
          <aside style={{
            width: '220px',
            background: '#0f172a',
            color: '#e2e8f0',
            borderRight: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            padding: '0',
            flexShrink: 0,
          }}>
            <Link href="/" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '80px',
              background: '#ffffff',
              borderBottom: '1px solid #e2e8f0',
              marginBottom: '16px',
              textDecoration: 'none',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <img
                src="/citytech-logo.png"
                alt="Citytech"
                style={{
                  height: '36px',
                  width: 'auto',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </Link>

            {[
              { href: '/', label: 'Overview' },
              { href: '/releases', label: 'Releases' },
              { href: '/issues', label: 'Issues' },
              { href: '/workload', label: 'Team workload' },
              { href: '/notifications', label: 'Notifications' },
            ].map(item => (
              <Link key={item.href} href={item.href} style={{
                padding: '10px 18px',
                fontSize: '14px',
                color: '#cbd5e1',
                textDecoration: 'none',
                display: 'block',
                borderRadius: '8px',
                margin: '0 8px 6px 8px',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '9999px', background: '#94a3b8' }} />
                  {item.label}
                </span>
              </Link>
            ))}

            <div style={{ marginTop: 'auto', padding: '12px 18px', fontSize: '12px', color: '#94a3b8' }}>
              Built for Citytech UAT
            </div>
          </aside>

          <main style={{ flex: 1, overflow: 'auto' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}