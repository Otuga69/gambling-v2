import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const pocketbaseHandler: Handle = async ({ event, resolve }) => {
    // Initialize PocketBase with the event's fetch instance
    const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
    
    // IMPORTANT: Override the default fetch instance
    pb._send = async (path, options) => {
        try {
            const url = path.startsWith('http') ? path : `${PUBLIC_POCKETBASE_URL}${path}`;
            const response = await event.fetch(url, options);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return response;
        } catch (error) {
            console.error('PocketBase request error:', error);
            throw error;
        }
    };

    event.locals.pb = pb;

    // Load auth state from cookie
    event.locals.pb.authStore.loadFromCookie(event.request.headers.get('cookie') || '');

    try {
        // Refresh auth if logged in
        if (event.locals.pb.authStore.isValid) {
            await event.locals.pb.collection('users').authRefresh();
            // Add the user to locals
            event.locals.user = structuredClone(event.locals.pb.authStore.model);
        }
    } catch (_) {
        event.locals.pb.authStore.clear();
    }

    const response = await resolve(event);

    // Set the cookie with the updated auth state
    response.headers.set('set-cookie', event.locals.pb.authStore.exportToCookie());

    return response;
};

const unprotectedRoutes = ['/login', '/register', '/'];
const authorization: Handle = async ({ event, resolve }) => {
    if (!unprotectedRoutes.includes(event.url.pathname)) {
        if (!event.locals.pb.authStore.isValid) {
            throw redirect(303, '/login');
        }
    }
    return await resolve(event);
};

export const handle = sequence(pocketbaseHandler, authorization);