import { fail, redirect } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import type { PageServerLoad } from './$types';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';

export const load = (async ({locals}) => {    
    if (locals.pb.authStore.model) {
        // return redirect(303, '/dashboard')
    }

    return {};
}) satisfies PageServerLoad;

export const actions = {
    register: async ({ locals, request }) => {
        const data = await request.formData();
        const email = data.get('email');
        const password = data.get('password');
        const username = data.get('username');
        
        if (!email || !password) {
            return fail(400, { 
                emailRequired: email === null, 
                passwordRequired: password === null 
            });
        }
    
        const userData = {
            email: email.toString(),
            password: password.toString(),
            passwordConfirm: password.toString(),
            // Optional: add username if required
            username: username ? username.toString() : email.toString().split('@')[0], // Creates username from email
        };
        
        try {
            // Add more detailed logging
            console.log('Registration attempt:', {
                email: userData.email,
                username: userData.username,
                url: PUBLIC_POCKETBASE_URL
            });
            
            const createdUser = await locals.pb.collection('users').create(userData);
            
            if (createdUser) {
                // Log successful user creation
                console.log('User created successfully:', {
                    id: createdUser.id,
                    email: createdUser.email
                });

                // Authenticate the user
                await locals.pb.collection('users').authWithPassword(
                    userData.email,
                    userData.password
                );

                // Request email verification
                await locals.pb.collection('users').requestVerification(userData.email);
            }
        } catch (error) {
            const errorObj = error as ClientResponseError;
            console.error('Registration error:', {
                message: errorObj.message,
                data: errorObj.data,
                url: errorObj.url,
                status: errorObj.status,
                response: errorObj.response
            });
            
            return fail(500, {
                fail: true,
                message: errorObj.message || 'Registration failed. Please try again.'
            });
        }
    
        throw redirect(303, '/editdashboard');
    },
    
    reset: async ({ locals, request }) => {
        const data = await request.formData();
        const email = data.get('email');
        
        if (!email) {
            return fail(400, { emailRequired: email === null });
        }

        try {
            await locals.pb.collection('users').requestPasswordReset(email.toString());
        } catch (error) {
            const errorObj = error as ClientResponseError;
            return fail(500, {fail: true, message: errorObj.data.message});
        }

        throw redirect(303, '/login');
    }
}