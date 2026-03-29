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
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
          <aside style={{
            width: '220px',
            background: '#0f172a',
            color: '#e2e8f0',
            borderRight: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px 0',
            flexShrink: 0,
          }}>
            <Link href="/" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '0 18px 16px',
              borderBottom: '1px solid #1e293b',
              marginBottom: '12px',
              textDecoration: 'none',
              color: '#f8fafc',
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#0f172a',
                overflow: 'hidden',
                position: 'relative',
              }}>
                <Image src="/citytech-logo.png" alt="Citytech" fill style={{ objectFit: 'cover' }} />
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>Citytech</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '0.02em' }}>PM Dashboard</div>
              </div>
            </Link>

            {[
              { href: '/', label: 'Overview' },
              { href: '/releases', label: 'Releases' },
              { href: '/issues', label: 'Issues' },
              { href: '/workload', label: 'Team workload' },
              { href: '/reports', label: 'Reports' },
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