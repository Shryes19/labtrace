import './globals.css';

export const metadata = {
  title: 'LabTrace - Lab Asset Failure Tracking & Predictive Maintenance',
  description: 'Intelligent laboratory asset failure tracking, maintenance management and predictive reliability system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
