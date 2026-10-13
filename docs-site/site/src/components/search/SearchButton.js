// Search box in the global bar: opens the search dialog on click and on Ctrl/Cmd+K.
import React, { useEffect, useState } from 'react';
import SearchDialog from './SearchDialog.js';
import { useSearchContext } from './useSearch.js';

export default function SearchButton() {
  const [open, setOpen] = useState(false);
  const [mac, setMac] = useState(false);
  const ctx = useSearchContext();
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <button type="button" className="search-button" onClick={() => setOpen(true)} aria-label="Search the documentation" aria-keyshortcuts="Control+K Meta+K">
        <span aria-hidden="true">🔍</span>
        <span className="search-button__label">Search</span>
        <kbd className="search-button__key">{mac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <SearchDialog open={open} onClose={() => setOpen(false)} ctx={ctx} />
    </>
  );
}
