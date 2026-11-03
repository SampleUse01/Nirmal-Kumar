import forms from "@tailwindcss/forms";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17243a",
        muted: "#718096",
        brand: "#4659e8",
        canvas: "#f6f7fb"
      },
      boxShadow: {
        card: "0 12px 40px rgba(27, 38, 70, .07)"
      }
    }
  },
  plugins: [forms]
};
