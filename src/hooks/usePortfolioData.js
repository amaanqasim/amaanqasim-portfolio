import { useState, useEffect, useCallback } from 'react';
import DEFAULT_DATA, { THEME_PRESETS } from '../data/portfolioData';
import { savePortfolioData as persistPortfolioData } from '../auth/adminAuth';

let sharedData = DEFAULT_DATA;
let loadPromise;

async function loadPortfolio() {
  if (!loadPromise) {
    loadPromise = fetch('/api/portfolio', { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error('Portfolio data is unavailable.');
        return response.json();
      })
      .then((data) => { sharedData = data; return data; })
      .finally(() => { loadPromise = null; });
  }
  return loadPromise;
}

export function usePortfolioData() {
  const [data, setData] = useState(sharedData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const next = await loadPortfolio();
      sharedData = next;
      setData(next);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadPortfolio().then((next) => {
      sharedData = next;
      if (!cancelled) { setData(next); setError(''); }
    }).catch((err) => {
      if (!cancelled) setError(err.message);
    }).finally(() => { if (!cancelled) setLoading(false); });
    const update = () => { setData(sharedData); };
    window.addEventListener('portfolio-data-updated', update);
    return () => { cancelled = true; window.removeEventListener('portfolio-data-updated', update); };
  }, []);

  const updateData = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(sharedData) : updater;
    sharedData = next;
    setData(next);
    window.dispatchEvent(new CustomEvent('portfolio-data-updated'));
    persistPortfolioData(next).then(() => {
      window.dispatchEvent(new CustomEvent('portfolio-save-success'));
    }).catch((err) => {
      window.dispatchEvent(new CustomEvent('portfolio-save-error', { detail: { message: err.message } }));
      refresh();
    });
  }, [refresh]);

  return { data, updateData, loading, error, refresh };
}

export function useTheme() {
  const { data, updateData } = usePortfolioData();
  const preset = THEME_PRESETS[data.theme?.preset] || THEME_PRESETS.amber;
  const defaultMode = data.theme?.mode || 'dark';
  const [localOverride, setLocalOverride] = useState(() => localStorage.getItem('visitor_theme_override') || null);

  useEffect(() => {
    const handleLocalTheme = () => setLocalOverride(localStorage.getItem('visitor_theme_override') || null);
    window.addEventListener('visitor-theme-updated', handleLocalTheme);
    return () => window.removeEventListener('visitor-theme-updated', handleLocalTheme);
  }, []);

  const activeMode = localOverride || defaultMode;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary-hsl', preset.primary);
    root.style.setProperty('--primary-rgb', preset.primaryRGB);
    root.style.setProperty('--accent-hsl', preset.accent);
    root.style.setProperty('--glow-hsl', preset.glow);
    root.setAttribute('data-theme', activeMode);
    const color = preset.hex || '#ffaa00';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#0f0f17"/><text x="50" y="68" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="52" fill="${color}">AQ</text></svg>`;
    let link = document.querySelector("link[rel*='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = `data:image/svg+xml;base64,${btoa(svg)}`;
  }, [preset, activeMode]);

  const setThemePreset = (presetKey) => updateData((prev) => ({ ...prev, theme: { ...prev.theme, preset: presetKey } }));
  const toggleLocalMode = () => {
    const next = activeMode === 'dark' ? 'light' : 'dark';
    localStorage.setItem('visitor_theme_override', next);
    setLocalOverride(next);
    window.dispatchEvent(new CustomEvent('visitor-theme-updated'));
  };
  const setDefaultMode = (modeName) => {
    localStorage.removeItem('visitor_theme_override');
    setLocalOverride(null);
    window.dispatchEvent(new CustomEvent('visitor-theme-updated'));
    updateData((prev) => ({ ...prev, theme: { ...prev.theme, mode: modeName } }));
  };

  return { preset, presetKey: data.theme?.preset, setThemePreset, toggleMode: toggleLocalMode, setDefaultMode, setMode: setDefaultMode, mode: activeMode, defaultMode };
}
