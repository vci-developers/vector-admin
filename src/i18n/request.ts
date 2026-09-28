import { getRequestConfig } from 'next-intl/server';

// burnedout: English only in v1; add a locale cookie when fr/es land
export default getRequestConfig(async () => ({
    locale: 'en',
    messages: (await import('../../messages/en.json')).default,
}));
