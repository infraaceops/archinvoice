export const appConfig = {
  appName: 'ArchInvoice',
  appDomain: process.env.EXPO_PUBLIC_APP_DOMAIN || 'archinvoice.infraaceops.com',
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || '',
  authProvider: process.env.EXPO_PUBLIC_AUTH_PROVIDER || 'firebase',
  isCloudflareApiEnabled: Boolean(process.env.EXPO_PUBLIC_API_BASE_URL),
};

export const buildApiUrl = (path: string): string => {
  const base = (appConfig.apiBaseUrl || '').replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};
