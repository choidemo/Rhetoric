import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI를 설득해라!',
  description: 'AI와 토론하며 설득 능력을 키워보세요.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}