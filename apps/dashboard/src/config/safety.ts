/**
 * ZakOps Agent Safety Configuration
 * ==================================
 *
 * Global safety settings and kill switches for agent behavior.
 * These settings override tool-level configurations.
 */

// =============================================================================
// SAFETY CONFIG INTERFACE
// =============================================================================

export interface SafetyConfig {
  /**
   * Master kill switch for auto-execution.
   * When false, ALL tools require approval regardless of risk level.
   */
  AUTO_EXECUTE_ENABLED: boolean;

  /**
   * Allow auto-execution of low-risk tools (read-only operations).
   * Only applies when AUTO_EXECUTE_ENABLED is true.
   */
  AUTO_EXECUTE_LOW_RISK_TOOLS: boolean;

  /**
   * Allow auto-execution of medium-risk tools.
   * Only applies when AUTO_EXECUTE_ENABLED is true.
   * NOT RECOMMENDED for production.
   */
  AUTO_EXECUTE_MEDIUM_RISK_TOOLS: boolean;

  /**
   * Maximum number of tool calls allowed per run.
   * Prevents runaway agent behavior.
   */
  MAX_TOOL_CALLS_PER_RUN: number;

  /**
   * Maximum number of runs per minute per operator.
   * Prevents abuse and runaway costs.
   */
  MAX_RUNS_PER_MINUTE: number;

  /**
   * Maximum run duration in milliseconds.
   * Runs exceeding this are automatically terminated.
   */
  MAX_RUN_DURATION_MS: number;

  /**
   * Tools that ALWAYS require approval regardless of risk level.
   * This is a safety override list.
   */
  ALWAYS_REQUIRE_APPROVAL: string[];

  /**
   * Tools that are completely disabled.
   * Agent cannot use these tools at all.
   */
  DISABLED_TOOLS: string[];

  /**
   * Approval request expiration in milliseconds.
   * Pending approvals older than this are automatically expired.
   */
  APPROVAL_EXPIRATION_MS: number;

  /**
   * Enable detailed audit logging.
   * Logs all tool calls, approvals, and events.
   */
  AUDIT_LOGGING_ENABLED: boolean;

  /**
   * Enable real-time alerts for high-risk tool usage.
   */
  ALERT_ON_HIGH_RISK_TOOLS: boolean;

  /**
   * Webhook URL for safety alerts.
   */
  ALERT_WEBHOOK_URL?: string;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  // Auto-execution settings
  AUTO_EXECUTE_ENABLED: true,
  AUTO_EXECUTE_LOW_RISK_TOOLS: true,
  AUTO_EXECUTE_MEDIUM_RISK_TOOLS: false,

  // Rate limits
  MAX_TOOL_CALLS_PER_RUN: 50,
  MAX_RUNS_PER_MINUTE: 10,
  MAX_RUN_DURATION_MS: 5 * 60 * 1000, // 5 minutes

  // Safety overrides
  ALWAYS_REQUIRE_APPROVAL: [
    'send_email',
    'submit_loi',
    'sign_document',
    'reject_deal',
    'archive_deal',
    'schedule_meeting',
    'request_documents',
    'share_deal',
  ],

  DISABLED_TOOLS: [],

  // Approval settings
  APPROVAL_EXPIRATION_MS: 24 * 60 * 60 * 1000, // 24 hours

  // Monitoring
  AUDIT_LOGGING_ENABLED: true,
  ALERT_ON_HIGH_RISK_TOOLS: true,
  ALERT_WEBHOOK_URL: undefined,
};

// =============================================================================
// PRODUCTION CONFIGURATION (More Restrictive)
// =============================================================================

export const PRODUCTION_SAFETY_CONFIG: SafetyConfig = {
  ...DEFAULT_SAFETY_CONFIG,

  // Stricter rate limits in production
  MAX_TOOL_CALLS_PER_RUN: 30,
  MAX_RUNS_PER_MINUTE: 5,
  MAX_RUN_DURATION_MS: 3 * 60 * 1000, // 3 minutes

  // Never auto-execute medium risk in production
  AUTO_EXECUTE_MEDIUM_RISK_TOOLS: false,
};

// =============================================================================
// LOCKDOWN CONFIGURATION (Emergency)
// =============================================================================

export const LOCKDOWN_SAFETY_CONFIG: SafetyConfig = {
  ...DEFAULT_SAFETY_CONFIG,

  // Disable ALL auto-execution
  AUTO_EXECUTE_ENABLED: false,
  AUTO_EXECUTE_LOW_RISK_TOOLS: false,
  AUTO_EXECUTE_MEDIUM_RISK_TOOLS: false,

  // Very low limits
  MAX_TOOL_CALLS_PER_RUN: 10,
  MAX_RUNS_PER_MINUTE: 2,
  MAX_RUN_DURATION_MS: 1 * 60 * 1000, // 1 minute

  // Disable external communication tools entirely
  DISABLED_TOOLS: [
    'send_email',
    'submit_loi',
    'sign_document',
    'schedule_meeting',
    'request_documents',
    'share_deal',
  ],

  // Short approval window
  APPROVAL_EXPIRATION_MS: 1 * 60 * 60 * 1000, // 1 hour

  // Maximum monitoring
  AUDIT_LOGGING_ENABLED: true,
  ALERT_ON_HIGH_RISK_TOOLS: true,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Determine if a tool should auto-execute based on config and tool properties.
 */
export function shouldAutoExecute(
  config: SafetyConfig,
  toolName: string,
  riskLevel: 'low' | 'medium' | 'high' | 'critical',
  toolRequiresApproval: boolean,
  hasExternalImpact: boolean
): boolean {
  // Master kill switch
  if (!config.AUTO_EXECUTE_ENABLED) {
    return false;
  }

  // Check disabled tools
  if (config.DISABLED_TOOLS.includes(toolName)) {
    return false;
  }

  // Check always-require-approval list
  if (config.ALWAYS_REQUIRE_APPROVAL.includes(toolName)) {
    return false;
  }

  // External impact = never auto-execute
  if (hasExternalImpact) {
    return false;
  }

  // Tool-level setting
  if (toolRequiresApproval) {
    return false;
  }

  // Risk-level based
  switch (riskLevel) {
    case 'low':
      return config.AUTO_EXECUTE_LOW_RISK_TOOLS;
    case 'medium':
      return config.AUTO_EXECUTE_MEDIUM_RISK_TOOLS;
    case 'high':
    case 'critical':
      return false; // Never auto-execute
    default:
      return false;
  }
}

/**
 * Check if a tool is disabled.
 */
export function isToolDisabled(
  config: SafetyConfig,
  toolName: string
): boolean {
  return config.DISABLED_TOOLS.includes(toolName);
}

/**
 * Get current safety config from environment.
 */
export function getSafetyConfig(): SafetyConfig {
  const env = process.env.NODE_ENV || 'development';
  const safetyMode = process.env.SAFETY_MODE || 'default';

  if (safetyMode === 'lockdown') {
    return LOCKDOWN_SAFETY_CONFIG;
  }

  if (env === 'production') {
    return PRODUCTION_SAFETY_CONFIG;
  }

  return DEFAULT_SAFETY_CONFIG;
}

/**
 * Validate safety config for consistency.
 */
export function validateSafetyConfig(config: SafetyConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Rate limits must be positive
  if (config.MAX_TOOL_CALLS_PER_RUN <= 0) {
    errors.push('MAX_TOOL_CALLS_PER_RUN must be positive');
  }
  if (config.MAX_RUNS_PER_MINUTE <= 0) {
    errors.push('MAX_RUNS_PER_MINUTE must be positive');
  }
  if (config.MAX_RUN_DURATION_MS <= 0) {
    errors.push('MAX_RUN_DURATION_MS must be positive');
  }

  // Approval expiration must be reasonable
  if (config.APPROVAL_EXPIRATION_MS < 60 * 1000) {
    errors.push('APPROVAL_EXPIRATION_MS should be at least 1 minute');
  }
  if (config.APPROVAL_EXPIRATION_MS > 7 * 24 * 60 * 60 * 1000) {
    errors.push('APPROVAL_EXPIRATION_MS should not exceed 7 days');
  }

  // Can't have conflicting settings
  if (
    config.AUTO_EXECUTE_MEDIUM_RISK_TOOLS &&
    !config.AUTO_EXECUTE_LOW_RISK_TOOLS
  ) {
    errors.push(
      'Cannot auto-execute medium risk but not low risk tools'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Merge safety config with overrides.
 */
export function mergeSafetyConfig(
  base: SafetyConfig,
  overrides: Partial<SafetyConfig>
): SafetyConfig {
  return {
    ...base,
    ...overrides,
    // Arrays should be merged, not replaced
    ALWAYS_REQUIRE_APPROVAL: [
      ...new Set([
        ...base.ALWAYS_REQUIRE_APPROVAL,
        ...(overrides.ALWAYS_REQUIRE_APPROVAL || []),
      ]),
    ],
    DISABLED_TOOLS: [
      ...new Set([
        ...base.DISABLED_TOOLS,
        ...(overrides.DISABLED_TOOLS || []),
      ]),
    ],
  };
}
