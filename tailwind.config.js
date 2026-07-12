/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#fdfbf7",
        foreground: "#1f2937",
        card: "#ffffff",
        "card-foreground": "#1f2937",
        primary: "#4f46e5",
        "primary-foreground": "#ffffff",
        secondary: "#f5efe7",
        "secondary-foreground": "#1f2937",
        muted: "#f5efe7",
        "muted-foreground": "#6b7280",
        accent: "#f5efe7",
        "accent-foreground": "#1f2937",
        destructive: "#dc2626",
        "destructive-foreground": "#ffffff",
        border: "#eae5d9",
        input: "#eae5d9",
        ring: "#4f46e5",
      },
      boxShadow: {
        "soft-xl": "0 20px 45px -20px rgba(79, 70, 229, 0.25)",
      },
    },
  },
  plugins: [],
};
