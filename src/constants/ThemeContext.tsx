"use client"

import type React from "react"
import { createContext, useContext, useState, type ReactNode } from "react"
import { theme as defaultTheme } from "../constants/theme"

type Theme = typeof defaultTheme

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
  initialTheme?: Theme
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, initialTheme = defaultTheme }) => {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
