import { useEffect, useState } from 'react';

// Undo/Redo enablement depends on whether a text field has focus, which changes without any
// model or UI-store update; this re-renders the caller so menus can follow it.
export function useFocusVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => {
      setVersion((v) => v + 1);
    };
    document.addEventListener('focusin', bump);
    document.addEventListener('focusout', bump);
    return () => {
      document.removeEventListener('focusin', bump);
      document.removeEventListener('focusout', bump);
    };
  }, []);
  return version;
}
