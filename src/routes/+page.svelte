<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { goto } from "$app/navigation";
	
	// Array of basic human needs with navigation paths
	const basicNeeds = [
		{ title: "Crash", path: "/crashgame" },
		{ title: "Water & Hydration", path: "/water" },
		{ title: "Shelter & Housing", path: "/shelter" },
		{ title: "Sleep & Rest", path: "/sleep" },
		{ title: "Healthcare & Safety", path: "/health" }
	];
	
	function gotoPage(path: string): void {
		goto(path);
	}
	
	// Keyboard handler for accessibility
	function handleKeydown(event: KeyboardEvent, path: string): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			gotoPage(path);
		}
	}
</script>

<section class="container mx-auto p-4">
	<!-- Main heading -->
	<h2 class="h2 mb-6">Basic things human need</h2>
	
	<!-- Card grid with narrower width and greater height -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto ">
		{#each basicNeeds as need}
			<button 
			class="card variant-filled-surface card-hover p-4 h-40 w-full text-left shine" 
				on:click={() => gotoPage(need.path)}
				on:keydown={(e) => handleKeydown(e, need.path)}
			>
				<header class="card-header text-xl font-semibold">{need.title}</header>
				<section class="p-2 ">
					<p class="opacity-75 text-sm">Essential for human well-being</p>
				</section>
			</button>
		{/each}
	</div>
</section>