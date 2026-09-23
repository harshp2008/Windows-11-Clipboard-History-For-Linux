/**
 * Symbol Picker Hook
 * Manages symbol state, search, and recently used symbols
 */
import { useState, useMemo, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getSymbols, getSymbolCategories, type SymbolItem } from '../services/symbolService'

const RECENT_SYMBOLS_KEY = 'win11_clipboard_recent_symbols'
const MAX_RECENT_SYMBOLS = 24

export function useSymbolPicker() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const [recentSymbols, setRecentSymbols] = useState<SymbolItem[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_SYMBOLS_KEY)
      if (stored) {
        return JSON.parse(stored) as SymbolItem[]
      }
    } catch (e) {
      console.error('Failed to load recent symbols', e)
    }
    return []
  })

  const categories = useMemo(() => getSymbolCategories(), [])

  // Filtered symbols
  const filteredSymbols = useMemo(() => {
    return getSymbols(selectedCategory, searchQuery)
  }, [selectedCategory, searchQuery])

  // Paste symbol while keeping the picker open for consecutive selections.
  const pasteSymbol = useCallback(async (symbol: SymbolItem) => {
    try {
      await invoke('paste_text', { text: symbol.char, hideWindow: false })

      // Update recent
      setRecentSymbols((prev) => {
        const filtered = prev.filter((s) => s.char !== symbol.char)
        const newRecent = [symbol, ...filtered].slice(0, MAX_RECENT_SYMBOLS)
        localStorage.setItem(RECENT_SYMBOLS_KEY, JSON.stringify(newRecent))
        return newRecent
      })
    } catch (err) {
      console.error('Failed to paste symbol:', err)
    }
  }, [])

  return {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    categories,
    filteredSymbols,
    recentSymbols,
    pasteSymbol,
  }
}
