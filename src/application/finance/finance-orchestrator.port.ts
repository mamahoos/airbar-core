/**
 * Application port for orchestrating airbar-finance commands.
 * Implementation lands in N6; N1 defines the contract only.
 */
export interface FinanceReadyStatus {
  readonly ready: boolean;
}

export interface FinanceOrchestratorPort {
  checkFinanceReady(): Promise<FinanceReadyStatus>;
}

export const FINANCE_ORCHESTRATOR = Symbol('FINANCE_ORCHESTRATOR');
