// src/lib/monnify/index.ts
// Single import point for all consumers: import { ... } from '@/lib/monnify'
//
// server-service.ts is server-only (imports 'server-only').
// client-config.ts is safe to import in both server and client components.
// There is no circular dependency — client-config does not import server-service.

export {
  MonnifyServerService,
  MonnifyError,
} from './server-service';

export type {
  MonnifyTransactionInit,
  MonnifyTransactionResponse,
  MonnifyVerifyResponse,
  MonnifyTransferInit,
  MonnifyTransferResponse,
} from './server-service';

export {
  MONNIFY_ENV,
  monnifyClientConfig,
  generateClientTxRef,
} from './client-config';

export type { MonnifyClientConfig } from './client-config';