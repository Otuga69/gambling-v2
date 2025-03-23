<script lang="ts">
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { crashGame, type GameState } from '$lib/stores/crashGame';
  
  export let width = 800;
  export let height = 400;
  
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  
  // Subscribe to game state
  let gameState: GameState;
  const unsubscribe = crashGame.subscribe(state => {
    gameState = state;
    // Ensure canvas is ready before drawing
    if (ctx) {
      requestAnimationFrame(drawGameState);
    }
  });
  
  // Handle canvas sizing and scrolling
  $: if (gameState?.pointsHistory.length > 0) {
    const lastPoint = gameState.pointsHistory[gameState.pointsHistory.length - 1];
    if (lastPoint.x > width) {
      crashGame.adjustPointsHistory(width);
    }
  }
  
  function drawGameState() {
    if (!ctx || !gameState) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 0.5;
    
    // Horizontal grid lines
    for (let i = 0; i <= 10; i++) {
      const y = height - (i * (height / 10));
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
      const x = i * (width / 10);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Draw crash point line
    if (gameState.isCrashed) {
      ctx.strokeStyle = "#ff3333";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, height - (Math.log(gameState.crashPoint) * 50));
      ctx.lineTo(width, height - (Math.log(gameState.crashPoint) * 50));
      ctx.stroke();
    }
    
    // Draw multiplier trail
    if (gameState.pointsHistory.length > 1) {
      ctx.strokeStyle = gameState.isCrashed ? "#ff3333" : 
                       gameState.userCashedOut ? "#33ff33" : "#3333ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(gameState.pointsHistory[0].x, gameState.pointsHistory[0].y);
      
      for (let i = 1; i < gameState.pointsHistory.length; i++) {
        ctx.lineTo(gameState.pointsHistory[i].x, gameState.pointsHistory[i].y);
      }
      ctx.stroke();
    }
    
    // Draw current point
    if (gameState.pointsHistory.length > 0) {
      const lastPoint = gameState.pointsHistory[gameState.pointsHistory.length - 1];
      ctx.fillStyle = gameState.isCrashed ? "#ff3333" : 
                     gameState.userCashedOut ? "#33ff33" : "#3333ff";
      ctx.beginPath();
      ctx.arc(lastPoint.x, lastPoint.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Monitor for state changes and redraw
  afterUpdate(() => {
    if (ctx) {
      drawGameState();
    }
  });
  
  onMount(() => {
    ctx = canvas.getContext('2d')!;
    drawGameState();
  });
  
  onDestroy(() => {
    unsubscribe();
  });
</script>

<canvas 
  bind:this={canvas} 
  {width}
  {height}
  class="w-full h-64"
></canvas>