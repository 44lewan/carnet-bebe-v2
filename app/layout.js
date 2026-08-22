import "./globals.css";

export const metadata = {
  title: "Petit Carnet",
  description: "Le carnet de suivi de bébé, partagé entre parents",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#7C9473",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
