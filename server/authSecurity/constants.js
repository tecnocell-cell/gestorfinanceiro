export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
export const EMAIL_VERIFY_TOKEN_TTL_HOURS = parseInt(process.env.EMAIL_VERIFY_TOKEN_TTL_HOURS || '24', 10);
export const PASSWORD_RESET_TTL_MIN = parseInt(process.env.PASSWORD_RESET_TTL_MIN || '60', 10);
