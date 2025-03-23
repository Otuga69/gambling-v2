<script lang="ts">
    import type { ActionData } from './$types';
    import { enhance } from '$app/forms';
    
    export let form: ActionData;
    
    // Track form submission state
    let isSubmitting = false;
</script>

<div class="flex justify-center items-center min-h-screen p-4">
    <div class="card w-full max-w-sm shadow-xl">
        <header class="card-header p-4 border-b border-surface-200-700-token">
            <h2 class="h3 font-semibold">Login</h2>
        </header>
        
        {#if form?.fail}
            <div class="alert variant-filled-error mx-4 mt-4">
                <span>{form.message}</span>
            </div>
        {/if}
        
        <div class="p-4">
            <form 
                action="?/login" 
                method="post" 
                class="space-y-4"
                use:enhance={() => {
                    isSubmitting = true;
                    
                    return async ({ update }) => {
                        await update();
                        isSubmitting = false;
                    };
                }}
            >
                <label class="label">
                    <span>Email</span>
                    <input 
                        class="input" 
                        name="email" 
                        type="email" 
                        placeholder="mail@example.com" 
                        required 
                        autocomplete="email"
                    />
                </label>
                
                <label class="label">
                    <span>Password</span>
                    <input 
                        class="input" 
                        name="password" 
                        type="password" 
                        placeholder="••••••" 
                        required 
                        autocomplete="current-password"
                    />
                </label>
                
                <div class="flex justify-end">
                    <button 
                        class="anchor text-sm"
                        formnovalidate 
                        formaction="?/reset"
                        type="submit"
                    >
                        Forgot Password?
                    </button>
                </div>
                
                <div class="space-y-4">
                    <button 
                        class="btn preset-filled-primary-500 w-[90%]" 
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {#if isSubmitting}
                            <span class="spinner-border"></span>
                        {:else}
                            Sign In
                        {/if}
                    </button>
                    
                    <p class="text-center text-sm mt-4">
                        Don't have an account? 
                        <a href="/register" class="text-blue-500 hover:underline">Register here</a>
                    </p>
                </div>
            </form>
        </div>
    </div>
</div>