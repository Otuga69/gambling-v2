<script lang="ts">
    import '../app.postcss';
    import { AppShell, AppBar, Avatar } from '@skeletonlabs/skeleton';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import * as config from '$lib/config';

    // Get user data from page store
    $: user = $page.data.user;

    function gotoHome() {
        goto('/login');
    }
</script>

<!-- App Shell -->
<AppShell>
    <svelte:fragment slot="header">
        <!-- App Bar -->
        <AppBar>
            <svelte:fragment slot="lead">
                <a href="/" class="title">
                    <strong>{config.title}</strong>
                </a>
            </svelte:fragment>
            <svelte:fragment slot="trail">
                {#if user}
                    <div class="btn-group">
                        <div class="card preset-outlined-surface-200-800 flex items-center p-1">
                            <span class="font-bold mr-1">🪙</span>
                            <p class="ml-1">{user.coins || 0}</p>
                        </div>
		    <Avatar initials={(() => {
			const name = user.username || user.email;
			if (name.includes(' ')) {
			    // For names with spaces (e.g., "John Doe" -> "JD")
				return name
					.split(' ')
					
					.join('');
			} else {
			    // For single words (e.g., "johnes1234" -> "Jo")
			    return name.slice(0, 2).toUpperCase();
			}
		      })()}
		      background="bg-primary-500"
		      width="w-10"
		       />
                    </div>
                {:else}
                    <div class="flex gap-2">
                        <button class="btn btn-sm variant-ghost-surface" on:click={gotoHome}>
                            Login
                        </button>
                        <a href="/register" class="btn btn-sm preset-filled-primary-500">
                            Sign Up
                        </a>
                    </div>
                {/if}
            </svelte:fragment>
        </AppBar>
    </svelte:fragment>
    <!-- Page Route Content -->
    <slot />
    <!-- Page Route Content -->
</AppShell>

<style>
    .title {
        color: rgb(218, 54, 54);
        font-size: 1.75rem;
    }
</style>
