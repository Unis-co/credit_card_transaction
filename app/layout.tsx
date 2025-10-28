export const metadata = {
  title: "My App",
  description: "Credit Card Dashboard",
    generator: 'v0.app'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


import './globals.css'