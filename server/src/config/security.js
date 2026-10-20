export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  return secret;
};

export const assertProductionSecurityConfig = () => {
  if (process.env.NODE_ENV !== 'production') return;

  const missing = ['JWT_SECRET', 'MONGODB_URI', 'GITHUB_WEBHOOK_SECRET']
    .filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
  }
};
