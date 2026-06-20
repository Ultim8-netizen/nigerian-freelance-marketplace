// src/lib/flutterwave/index.ts
// Single import point for all consumers: import { ... } from '@/lib/flutterwave'
//
// server-service.ts is server-only (imports 'server-only').
// client-config.ts is safe to import in both server and client components.
// There is no circular dependency — client-config does not import server-service.
//
// FIX: previously exported Monnify* symbols that do not exist in
// server-service.ts (it only exports Flutterwave* symbols) — leftover from
// the Monnify -> Flutterwave migration that renamed server-service.ts but
// never updated this barrel file. This broke `tsc`/`next build` for the
// whole project, regardless of whether anything imported this file.

export {
  FlutterwaveServerService,
  FlutterwaveError,
} from './server-service';

export type {
  FlutterwaveTransactionInit,
  FlutterwaveTransactionResponse,
  FlutterwaveVerifyResponse,
  FlutterwaveTransferInit,
  FlutterwaveTransferResponse,
} from './server-service';

export {
  FLUTTERWAVE_ENV,
  flutterwaveClientConfig,
  generateClientTxRef,
} from './client-config';

export type { FlutterwaveClientConfig } from './client-config';