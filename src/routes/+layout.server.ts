// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load = (({ locals }) => {
    return {
        user: locals.user || null
    };
}) satisfies LayoutServerLoad;