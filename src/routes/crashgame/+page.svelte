<!-- src/routes/crashgame/+page.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { crashGame, type GameState } from '$lib/stores/crashGame';
  import CrashGameCanvas from '$lib/components/CrashGameCanvas.svelte';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import PocketBase from 'pocketbase';
  import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
  
  // Reactive variables with explicit types
  let gameState: GameState;
  let currentMultiplier: number = 1;
  let pb: PocketBase;
  
  // Subscribe to stores
  const unsubGame = crashGame.subscribe(state => {
    gameState = state;
  });
  
  const unsubMultiplier = crashGame.currentMultiplier.subscribe(value => {
    currentMultiplier = value;
  });

  // Get the active PocketBase instance
  function getPbInstance(): PocketBase {
    // First check if we have a local instance already initialized
    if (pb && pb.authStore.isValid) {
      return pb;
    }
    
    // Next try to create a new local instance
    try {
      const localPb = new PocketBase(PUBLIC_POCKETBASE_URL);
      
      // Load auth from cookie
      if (document.cookie) {
        localPb.authStore.loadFromCookie(document.cookie);
      }
      
      // If valid, use it and update our reference
      if (localPb.authStore.isValid) {
        pb = localPb;
        return pb;
      }
    } catch (error) {
      console.error("Failed to initialize local PocketBase:", error);
    }
    
    // If all else fails, throw error
    throw new Error("No valid PocketBase instance available");
  }

  // Initialize user data on page load
  onMount(async () => {
    if (browser) {
      try {
        // First try to initialize with the server-provided user data
        if ($page.data.user && $page.data.authToken) {
          // Initialize a local PocketBase instance with the auth token
          pb = new PocketBase(PUBLIC_POCKETBASE_URL);
          pb.authStore.save($page.data.authToken, $page.data.user);
          
          // Reset game state first
          crashGame.reset();
          
          // Initialize with our PocketBase instance
          const success = await crashGame.initializeUser(pb, $page.data.user.id);
          
          if (!success) {
            console.error("Failed to initialize user data");
          }
          
          // Set up PocketBase for user record realtime updates 
          pb.collection('users').subscribe($page.data.user.id, function(e) {
            if (e.action === 'update') {
              // Update page data to reflect the new user data
              $page.data.user = { ...$page.data.user, ...e.record };
            }
          });
        } else {
          // Try to initialize from cookie as fallback
          const localPb = getPbInstance();
          
          if (localPb && localPb.authStore.model?.id) {
            const success = await crashGame.initializeUser(localPb, localPb.authStore.model.id);
            if (!success) {
              console.error("Failed to initialize user with local PB instance");
            }
          }
        }
      } catch (error) {
        console.error("Initialization error:", error);
        crashGame.update(state => ({
          ...state,
          error: "Failed to initialize game data. Please refresh the page."
        }));
      }
    }
  });
  
  async function handleStartGame() {
    if (!$page.data.user) {
      window.location.href = '/login';
      return;
    }
    
    // Get the active PocketBase instance
    const activePb = getPbInstance();
    
    if (!activePb) {
      crashGame.update(state => ({
        ...state,
        error: "Authentication error. Please refresh and try again."
      }));
      return;
    }
    
    console.log("Start game clicked via Svelte handler");
    await crashGame.startGame(activePb);
  }
  
  async function handleCashOut() {
    // Get the active PocketBase instance
    const activePb = getPbInstance();
    
    if (!activePb) {
      crashGame.update(state => ({
        ...state,
        error: "Authentication error. Please refresh and try again."
      }));
      return;
    }
    
    console.log("Cash out clicked via Svelte handler");
    await crashGame.cashOut(activePb);
  }
  
  // Periodic refresh of user data from server to ensure sync
  let refreshInterval: number;
  
  onMount(() => {
    if (browser) {
      // Set up a periodic refresh every 10 seconds to ensure data stays in sync
      refreshInterval = window.setInterval(async () => {
        try {
          const activePb = getPbInstance();
          if (activePb && !gameState.isRunning) {
            await crashGame.refreshUserData(activePb);
          }
        } catch (error) {
          console.error("Failed to refresh user data:", error);
        }
      }, 10000);
    }
  });
  
  // Handle input changes
  function updateBetAmount(e: Event) {
    const input = e.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (!isNaN(value) && value > 0) {
      crashGame.setBetAmount(value);
    }
  }
  
  // Clean up subscriptions on destroy
  onDestroy(() => {
    unsubGame();
    unsubMultiplier();
    crashGame.destroy();
    
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    // Unsubscribe from PocketBase realtime updates
    if (pb && $page.data.user) {
      pb.collection('users').unsubscribe($page.data.user.id);
    }
  });
</script>

<div class="flex flex-col items-center w-full max-w-4xl mx-auto p-4 text-white">
  <h1 class="text-3xl font-bold mb-6">Crash Game</h1>
  
  <!-- User Coins Display -->
  <div class="w-full flex justify-between items-center mb-4">
    <div class="text-xl font-bold">
      {#if $page.data.user}
        Coins$: {gameState?.userCoins || 0}
      {:else}
        <a href="/login" class="text-blue-400 hover:underline">Login to play</a>
      {/if}
    </div>
    
    {#if gameState?.error}
      <div class="bg-red-800 px-4 py-2 rounded-lg text-white">
        {gameState.error}
        <button 
          class="ml-2 text-white hover:text-gray-300" 
          on:click={() => crashGame.clearError()}>
          ✕
        </button>
      </div>
    {/if}
  </div>
  
  <!-- Game Display -->
  <div class="w-full bg-gray-800 rounded-lg p-4 mb-4 animated-border-box">
    <div class="flex justify-between items-center mb-2">
      <div class="flex items-center">
        <span class="text-lg font-semibold mr-2">Multiplier:</span>
        <span class="text-2xl font-bold" 
              class:text-red-500={gameState?.isCrashed} 
              class:text-green-500={gameState?.userCashedOut}>
          {gameState?.isCrashed ? "CRASHED" : currentMultiplier?.toFixed(2)}x
        </span>
      </div>
      {#if gameState?.userCashedOut}
        <div class="text-green-500 font-bold text-xl">
          Cashed Out: {gameState.userWinnings.toFixed(0)} coins
        </div>
      {/if}
      
      {#if gameState?.isCrashed && !gameState?.userCashedOut}
        <div class="text-red-500 font-bold text-xl">
          CRASHED AT {gameState.crashPoint.toFixed(2)}x
        </div>
      {/if}
    </div>
    
    <!-- Game Canvas -->
    <div class="w-full relative bg-gray-900 rounded border border-gray-700 overflow-hidden">
      <CrashGameCanvas width={800} height={400} />
    </div>
  </div>
  
  <!-- Controls -->
  <div class="flex flex-col md:flex-row w-full gap-4 mb-6">
    <div class="flex flex-col flex-1 bg-gray-800 rounded-lg p-4">
      <h2 class="text-xl font-semibold mb-2">Bet</h2>
      <div class="flex items-center mb-2">
        <input
          type="number"
          min="1"
          max={gameState?.userCoins || 0}
          value={gameState?.betAmount}
          on:input={updateBetAmount}
          class="bg-gray-700 text-white p-2 rounded w-full mr-2"
          disabled={gameState?.isRunning || !$page.data.user}
        />
        <span>coins</span>
      </div>

      <div class="flex gap-2 ">
        <!-- Game Start Button - Using proper Svelte event handling -->
        <button 
          on:click={handleStartGame}
          class="flex-1 px-4 py-2 font-semibold shine-button"
          disabled={gameState?.isRunning || !$page.data.user}>
          {gameState?.isRunning ? "In Progress..." : "Bet"}
        </button>

        <!-- Cash Out Button - Using proper Svelte event handling -->
        <button 
          on:click={handleCashOut}
          class="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-center text-white cursor-pointer rounded font-semibold"
          disabled={!gameState?.isRunning || gameState?.userCashedOut || gameState?.isCrashed}>
          Cash Out
        </button>
      </div>
    </div>
    
    <div class="flex-1 bg-gray-800 rounded-lg p-4">
      <h2 class="text-xl font-semibold mb-2">History</h2>
      <div class="flex flex-wrap gap-2">
        {#each gameState?.gameHistory || [] as crashValue}
          <div class="badge text-sm {crashValue < 2 ? 'bg-red-800' : crashValue < 4 ? 'bg-yellow-800' : 'bg-green-800'}">
            {crashValue.toFixed(2)}x
          </div>
        {/each}
      </div>
    </div>
  </div>
  
  
</div>