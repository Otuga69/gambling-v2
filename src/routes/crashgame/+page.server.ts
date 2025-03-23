// src/routes/crashgame/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// src/routes/crashgame/+page.server.ts
export const load = (async ({ locals }) => {
  if (!locals.pb.authStore.isValid || !locals.pb.authStore.model) {
    return { user: null };
  }

  try {
    const userData = await locals.pb.collection('users').getOne(locals.pb.authStore.model.id, {
      fields: 'id,email,username,coins,verified,emailVisibility'
    });
    
    return {
      user: userData,
      // Pass auth token to client for PocketBase initialization
      authToken: locals.pb.authStore.token
    };
  } catch (err) {
    console.error('Error loading user data:', err);
    return {
      user: locals.pb.authStore.model,
      authToken: locals.pb.authStore.token
    };
  }
}) satisfies PageServerLoad;