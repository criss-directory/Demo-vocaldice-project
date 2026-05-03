import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vocaldice — AI Voice Receptionist for Medical Clinics",
  description: "Give your clinic a 24/7 AI receptionist that speaks Telugu, Tamil, Kannada, Malayalam, Hindi and English. Books appointments, answers enquiries, and recovers missed calls automatically.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: "'Inter', sans-serif" }} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
