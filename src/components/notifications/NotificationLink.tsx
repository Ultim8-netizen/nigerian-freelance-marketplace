// src/components/notifications/NotificationLink.tsx
// Client component that awaits the markAsRead server action before navigating.
//
// WHY THIS EXISTS:
//   notifications/page.tsx previously wrapped linked notifications in a plain
//   <Link> component. That intercepts the click and navigates before any
//   server action can fire, making it impossible to mark the notification read
//   via the form/action pattern used by the rest of the page.
//   This component owns the click: it awaits the server action first, then
//   calls router.push(). If markAsRead throws (non-critical), it still
//   navigates — the read state is not worth blocking the user over.
'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface NotificationLinkProps {
  href:        string;
  markAsRead:  () => Promise<void>;
  children:    React.ReactNode;
}

export function NotificationLink({ href, markAsRead, children }: NotificationLinkProps) {
  const router               = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      try {
        await markAsRead();
      } catch {
        // Non-critical — the notification row failing to update must not
        // block the user from reaching the linked page.
      }
      router.push(href);
    });
  };

  return (
    <div
      onClick={handleClick}
      className={`cursor-pointer transition-opacity ${isPending ? 'opacity-60 pointer-events-none' : ''}`}
    >
      {children}
    </div>
  );
}