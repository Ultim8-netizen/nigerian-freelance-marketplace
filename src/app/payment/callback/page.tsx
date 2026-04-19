'use client';

// src/app/payment/callback/page.tsx
// Receives Monnify's post-payment redirect.
//
// Monnify appends these query params to redirectUrl:
//   paymentReference      — our generated ref (maps to monnify_payment_ref)
//   transactionReference  — Monnify's internal ref
//   paymentStatus         — "PAID" | "FAILED" | "PENDING"
//                           Do NOT trust this value alone — verifyPayment
//                           performs a server-to-server re-check.
//
// Next.js 14+ requires useSearchParams() to be inside a <Suspense> boundary.
// This file exports a shell that provides the boundary; CallbackContent is
// the actual page logic.

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePayments } from '@/hooks/usePayments';

// ── Types ─────────────────────────────────────────────────────────────────────

type PageState = 'verifying' | 'success' | 'already_paid' | 'failed' | 'missing_ref';

interface OrderMeta {
  orderId:    string | null;
  orderTitle: string | null;
}

// ── Spinner (shared between shell fallback and verifying state) ───────────────

function Spinner({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4 p-8">
        <div className="mx-auto h-12 w-12 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin" />
        <h1 className="text-xl font-semibold text-gray-900">{label}</h1>
        <p className="text-sm text-gray-500">This takes just a moment. Please don't close this tab.</p>
      </div>
    </div>
  );
}

// ── Inner component (uses useSearchParams — must be inside Suspense) ──────────

function CallbackContent() {
  const searchParams      = useSearchParams();
  const router            = useRouter();
  const { verifyPayment } = usePayments();

  const [pageState, setPageState]     = useState<PageState>('verifying');
  const [orderMeta, setOrderMeta]     = useState<OrderMeta>({ orderId: null, orderTitle: null });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Prevent double-fire in React Strict Mode / concurrent renders
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const paymentReference = searchParams.get('paymentReference');

    if (!paymentReference) {
      setPageState('missing_ref');
      return;
    }

    async function verify() {
      const result = await verifyPayment(paymentReference!);

      if (result.success) {
        const order = result.data.order as Record<string, unknown> | null;

        setOrderMeta({
          orderId:    order ? (order.id as string)    : null,
          orderTitle: order ? (order.title as string) : null,
        });

        // The verify route returns message: 'Payment already verified' when
        // the webhook already settled this transaction before the redirect
        // arrived. Render a distinct state so the UI doesn't falsely claim
        // we just confirmed the payment.
        if (result.message === 'Payment already verified') {
          setPageState('already_paid');
        } else {
          setPageState('success');
        }
      } else {
        setErrorMessage(result.error);
        setPageState('failed');
      }
    }

    verify();
  }, [searchParams, verifyPayment]);

  // Auto-redirect to the client order detail page on success
  useEffect(() => {
    if (
      (pageState === 'success' || pageState === 'already_paid') &&
      orderMeta.orderId
    ) {
      const timer = setTimeout(() => {
        // Client order detail lives at /client/orders/[id]
        // (confirmed from deliver/route.ts notification links)
        router.push(`/client/orders/${orderMeta.orderId}`);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [pageState, orderMeta.orderId, router]);

  // ── Verifying ───────────────────────────────────────────────────────────────
  if (pageState === 'verifying') {
    return <Spinner label="Confirming your payment…" />;
  }

  // ── Success ─────────────────────────────────────────────────────────────────
  if (pageState === 'success' || pageState === 'already_paid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-auto text-center space-y-6 p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">Payment Successful</h1>
            {orderMeta.orderTitle && (
              <p className="text-gray-600">
                Your payment for{' '}
                <span className="font-medium">{orderMeta.orderTitle}</span>{' '}
                has been confirmed and held in escrow.
              </p>
            )}
            {pageState === 'already_paid' && (
              <p className="text-sm text-gray-400">
                This payment was already confirmed — your order is active.
              </p>
            )}
          </div>

          <div className="space-y-3">
            {orderMeta.orderId ? (
              <>
                <Link
                  href={`/client/orders/${orderMeta.orderId}`}
                  className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  View Order
                </Link>
                <p className="text-xs text-gray-400">
                  Redirecting to your order in 4 seconds…
                </p>
              </>
            ) : (
              <Link
                href="/client/orders"
                className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                View My Orders
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Missing reference ───────────────────────────────────────────────────────
  if (pageState === 'missing_ref') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-auto text-center space-y-6 p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">Missing Payment Reference</h1>
            <p className="text-gray-600">
              We couldn't find a payment reference in this URL. If you completed
              a payment, it will still be confirmed automatically via our payment
              processor — check your orders in a few minutes.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href="/client/orders"
              className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              View My Orders
            </Link>
            <Link
              href="/support"
              className="block w-full rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Failed ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-auto text-center space-y-6 p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Payment Not Confirmed</h1>
          <p className="text-gray-600">
            We couldn't confirm your payment. Your card or account has not been
            charged, or any hold will be reversed automatically.
          </p>
          {errorMessage && (
            <p className="text-xs text-gray-400 font-mono bg-gray-50 rounded px-3 py-2 mt-2">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Link
            href="/client/orders"
            className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Back to My Orders
          </Link>
          <Link
            href="/support"
            className="block w-full rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Shell (default export) — provides the required Suspense boundary ──────────

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <CallbackContent />
    </Suspense>
  );
}