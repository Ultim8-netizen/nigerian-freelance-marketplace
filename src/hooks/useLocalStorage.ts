// src/hooks/useLocalStorage.ts
// LocalStorage hook with SSR safety

import { useState } from 'react'; // Removed unused useEffect

// Define the type for the setter, allowing T or a functional update (T => T)
type Setter<T> = T | ((prevState: T) => T);

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: Setter<T>) => void] {
  
  // State to store our value, initialized with a function to safely read from localStorage.
  const [storedValue, setStoredValue] = useState<T>(() => {
    // SSR Check: If window is undefined (running on the server), return the initial value immediately.
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      // If the item exists in localStorage, parse it; otherwise, use the provided initial value.
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // If an error occurs (e.g., localStorage is disabled or item is invalid JSON), log and return initial value.
      console.error(`Error loading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return wrapped version of useState's setter that persists to localStorage.
  const setValue = (value: Setter<T>) => {
    try {
      // 1. Calculate the new value: Handle both direct values and functional updates (like setCounter(c => c + 1)).
      const valueToStore = value instanceof Function ? value(storedValue) : value;

      // 2. Update React state
      setStoredValue(valueToStore);

      // 3. Persist to local storage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}