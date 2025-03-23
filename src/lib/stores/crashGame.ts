// src/lib/stores/crashGame.ts
import { writable, readable, derived, get } from 'svelte/store';
import type PocketBase from 'pocketbase';

export interface GamePoint {
  x: number;
  y: number;
}

export interface GameState {
  userId: string | null;
  userCoins: number;
  insertedAmount: number;  // Renamed from betAmount
  isRunning: boolean;
  isCrashed: boolean;
  userCashedOut: boolean;
  crashPoint: number;
  userWinnings: number;
  gameHistory: number[];
  multiplier: number;
  pointsHistory: GamePoint[];
  error: string | null;
  // Timer functionality
  isWaitingForNextRound: boolean;  // Renamed from isWaitingForBets
  roundStartTimer: number;  // Renamed from bettingWindowTimer
  hasInsertedCoins: boolean;  // New flag to track if user has coins in the current round
}

// Initialize multiplier store
const multiplier = writable(1.00);

// Initialize game state
const initialState: GameState = {
  userId: null,
  userCoins: 0,
  insertedAmount: 10,
  isRunning: false,
  isCrashed: false,
  userCashedOut: false,
  crashPoint: 0,
  userWinnings: 0,
  gameHistory: [],
  multiplier: 1.00,
  pointsHistory: [],
  error: null,
  // Timer properties
  isWaitingForNextRound: false,
  roundStartTimer: 30,
  hasInsertedCoins: false
};

function createCrashGameStore() {
  const { subscribe, set, update } = writable<GameState>(initialState);
  let gameInterval: ReturnType<typeof setInterval> | null = null;
  let timerInterval: number | null = null;
  let syncedWithServer = true; // Flag to track server synchronization
  
  return {
    subscribe,
    update: (updater: (state: GameState) => GameState) => {
      update(updater);
    },
    currentMultiplier: {
      subscribe: multiplier.subscribe
    },
    
    initializeUser: async (pb: PocketBase, userId: string) => {
      try {
        if (!pb || !userId) {
          console.error('Missing required parameters for initialization');
          return false;
        }
        
        // Get the latest user data from server to ensure we're in sync
        const userData = await pb.collection('users').getOne(userId);
        
        update(state => {
          return {
            ...state,
            userId: userId,
            userCoins: userData.coins || 0,
            insertedAmount: 10,  // Default insertion amount
            isWaitingForNextRound: true,  // Start with waiting for next round
            roundStartTimer: 30,
            hasInsertedCoins: false  // No coins inserted yet for this round
          };
        });
        
        // Start the round timer
        startRoundTimer();
        
        // Force an immediate update of the multiplier to ensure UI is consistent
        multiplier.set(1.00);
        syncedWithServer = true;
        
        // Set up a realtime subscription to the user record for continuous updates
        pb.collection('users').subscribe(userId, function(e) {
          if (e.action === 'update') {
            // Only update coins if we're not in the middle of a transaction
            if (syncedWithServer) {
              update(state => ({
                ...state,
                userCoins: e.record.coins || 0
              }));
            }
          }
        });
        
        return true; // Return success
      } catch (error) {
        console.error('Failed to initialize user:', error);
        update(state => ({
          ...state,
          error: 'Failed to initialize user data'
        }));
        return false;
      }
    },
    
    // Function to manually refresh user data from server
    refreshUserData: async (pb: PocketBase) => {
      const currentState = get({ subscribe });
      if (!pb || !currentState.userId) return false;
      
      try {
        const userData = await pb.collection('users').getOne(currentState.userId);
        update(state => ({
          ...state,
          userCoins: userData.coins || 0
        }));
        return true;
      } catch (error) {
        console.error('Failed to refresh user data:', error);
        return false;
      }
    },
    
    setInsertAmount: (amount: number) => {
      // Ensure insert amount is never less than 1
      const validAmount = Math.max(1, amount);
      
      update(state => ({
        ...state,
        insertedAmount: validAmount
      }));
    },
    
    // Renamed from startBettingWindowTimer to startRoundTimer
    startRoundTimer: () => {
      // Clear any existing timer
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      
      // Set initial state for round timer
      update(state => ({
        ...state,
        isWaitingForNextRound: true,
        roundStartTimer: 30
      }));
      
      // Start the countdown
      timerInterval = window.setInterval(() => {
        update(state => {
          // Decrement timer
          const newTimer = state.roundStartTimer - 1;
          
          // Check if timer has reached zero
          if (newTimer <= 0) {
            // Timer complete, clear interval and start game
            clearInterval(timerInterval!);
            timerInterval = null;
            
            // Start game automatically regardless of coin insertion
            setTimeout(() => {
              startGameAutomatically();
            }, 0);
            
            return {
              ...state,
              isWaitingForNextRound: false,
              roundStartTimer: 0
            };
          }
          
          return {
            ...state,
            roundStartTimer: newTimer
          };
        });
      }, 1000);
    },
    
    // New function to put coins into the game
    putCoins: async (pb: PocketBase) => {
      console.log("Put coins triggered with PB available:", !!pb);
      
      if (!pb) {
        console.error("PocketBase instance missing");
        update(state => ({ ...state, error: 'Authentication required' }));
        return;
      }
      
      // Access the store's current state
      const currentState = get({ subscribe });
      console.log("Current state before putting coins:", currentState);
      
      // Validate insertion amount
      if (currentState.insertedAmount <= 0) {
        console.error(`Invalid insertion amount: ${currentState.insertedAmount}, must be greater than 0`);
        update(state => ({
          ...state,
          error: 'Insert amount must be greater than 0'
        }));
        return;
      }
      
      // Check if insertion amount is within user's coins
      if (currentState.insertedAmount > currentState.userCoins) {
        console.error(`Insufficient coins: ${currentState.insertedAmount}, available coins: ${currentState.userCoins}`);
        update(state => ({
          ...state,
          error: 'Insufficient coins'
        }));
        return;
      }
      
      try {
        // Mark that we're about to make changes to server
        syncedWithServer = false;
        
        // First update PocketBase with the deducted coins
        if (currentState.userId) {
          // Deduct coins from user in PocketBase
          const newCoinBalance = currentState.userCoins - currentState.insertedAmount;
          
          try {
            console.log(`Updating user ${currentState.userId} coins to ${newCoinBalance} (deducting inserted coins)`);
            await pb.collection('users').update(currentState.userId, {
              coins: newCoinBalance
            });
            console.log("User coins updated successfully in database (coins deducted)");
          } catch (err) {
            console.error('Failed to update user coins in database:', err);
            syncedWithServer = true; // Reset sync flag
            update(state => ({
              ...state,
              error: 'Failed to insert coins'
            }));
            return; // Exit early if updating PocketBase fails
          }
        } else {
          console.error('Cannot update user record: Missing userId');
          syncedWithServer = true; // Reset sync flag
          update(state => ({
            ...state,
            error: 'User authentication error'
          }));
          return;
        }
        
        // Now update local state
        update(state => ({
          ...state,
          userCoins: state.userCoins - state.insertedAmount,
          hasInsertedCoins: true,  // Mark that user has coins in this round
          error: null
        }));
        
        // Now we're in sync with server again
        syncedWithServer = true;
      } catch (error) {
        console.error('Error inserting coins:', error);
        syncedWithServer = true; // Reset sync flag
        update(state => ({
          ...state,
          error: 'Failed to insert coins'
        }));
      }
    },
    
    // Removed startGame method in favor of private startGameAutomatically

    cashOut: async (pb: PocketBase) => {
      try {
        const currentState = get({ subscribe });
        
        // Enhanced validation to check inserted amount and hasInsertedCoins flag
        if (!currentState.isRunning || 
            currentState.userCashedOut || 
            currentState.isCrashed || 
            !currentState.hasInsertedCoins ||
            currentState.insertedAmount <= 0) {
          console.log("Cash out ignored - game not in cashable state or no coins inserted");
          return;
        }
        
        // Calculate winnings
        const currentMult = currentState.multiplier;
        const winnings = Math.floor(currentState.insertedAmount * currentMult);
        const newCoinBalance = currentState.userCoins + winnings;
        
        // Mark that we're making changes to server
        syncedWithServer = false;
        
        // Update UI state first for immediate feedback
        update(state => ({
          ...state,
          userCashedOut: true,
          userWinnings: winnings,
          userCoins: newCoinBalance
        }));
        
        // Update PocketBase
        if (pb && currentState.userId) {
          try {
            console.log(`Updating user ${currentState.userId} coins to ${newCoinBalance}`);
            await pb.collection('users').update(currentState.userId, {
              coins: newCoinBalance
            });
            console.log("User coins updated successfully in database");
          } catch (err) {
            console.error('Failed to update user coins in database:', err);
            update(state => ({
              ...state,
              error: 'Coins saved locally but failed to sync with server'
            }));
          }
        } else {
          console.error('Cannot update user record: Missing PocketBase or userId');
        }
        
        // Now we're in sync with server again
        syncedWithServer = true;
      } catch (error) {
        console.error('Error in cash out process:', error);
        syncedWithServer = true; // Reset sync flag
        update(state => ({
          ...state,
          error: 'Failed to cash out'
        }));
      }
    },
    
    clearError: () => {
      update(state => ({
        ...state,
        error: null
      }));
    },
    
    adjustPointsHistory: (canvasWidth: number) => {
      update(state => {
        if (!state.pointsHistory.length) return state;
        
        const lastPoint = state.pointsHistory[state.pointsHistory.length - 1];
        
        if (lastPoint && lastPoint.x > canvasWidth) {
          const diff = lastPoint.x - canvasWidth;
          const adjustedHistory = state.pointsHistory.map(point => ({
            x: point.x - diff,
            y: point.y
          }));
          
          return {
            ...state,
            pointsHistory: adjustedHistory
          };
        }
        
        return state;
      });
    },
    
    reset: () => {
      if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
      }
      
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      
      // Keep user ID and coins when resetting
      update(state => ({
        ...initialState,
        userId: state.userId,
        userCoins: state.userCoins,
        isWaitingForNextRound: true,
        roundStartTimer: 30
      }));
      
      multiplier.set(1);
      
      // Start round timer
      startRoundTimer();
    },
    
    destroy: () => {
      if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
      }
      
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      
      // Unsubscribe from PocketBase realtime if needed
      const currentState = get({ subscribe });
      if (currentState.userId) {
        // Note: We're not unsubscribing explicitly here because we don't have access to the PB instance
        // This will be handled automatically when the page is unloaded
      }
      
      // Reset state
      set(initialState);
      multiplier.set(1.00);
    },
    
    // Expose the startRoundTimer function
 
  };
}

// Private function to start the game automatically when timer expires
function startGameAutomatically() {
  const store = crashGame;
  const currentState = get(store);
  
  // Start the game regardless of whether coins were inserted
  store.update(state => ({
    ...state,
    isRunning: true,
    isCrashed: false,
    userCashedOut: false,
    isWaitingForNextRound: false,
    roundStartTimer: 0,
    pointsHistory: [{ x: 0, y: 400 }],
    error: null
  }));
  
  // Reset multiplier
  multiplier.set(1.00);
  
  // Starting the game simulation
  let currentMult = 1.00;
  let crashed = false;
  
  // Generate a crash point using a random algorithm
  const crashMultiplier = Math.random() < 0.33 ? 
    1 + Math.random() : // 33% chance of crashing early (1.00-2.00x)
    2 + Math.random() * 8; // 67% chance of going higher
  
  // Start game interval
  let gameInterval = window.setInterval(() => {
    if (crashed) {
      clearInterval(gameInterval);
      
      return;
    }
    
    // Increase multiplier at varying rates
    if (currentMult < 1.5) {
      currentMult += 0.01;
    } else if (currentMult < 5) {
      currentMult += 0.05;
    } else {
      currentMult += 0.1;
    }
    
    // Round to 2 decimal places
    currentMult = Math.round(currentMult * 100) / 100;
    multiplier.set(currentMult);
    
    // Update the pointsHistory for the graph
    store.update(state => {
      const x = state.pointsHistory.length * 5;
      const y = 400 - (Math.log(currentMult) * 50); // Adjust for canvas height
      
      return {
        ...state,
        multiplier: currentMult,
        pointsHistory: [...state.pointsHistory, { x, y }]
      };
    });
    
    // Check if we've reached the crash point
    if (currentMult >= crashMultiplier) {
      crashed = true;
      
      // Update game state
      store.update(state => {
        // Add to history
        const newHistory = [crashMultiplier, ...state.gameHistory];
        if (newHistory.length > 10) {
          newHistory.pop();
        }
        
        return {
          ...state,
          isRunning: false,
          isCrashed: true,
          crashPoint: crashMultiplier,
          gameHistory: newHistory,
          hasInsertedCoins: false // Reset for next round
        };
      });
      
      // Stop the interval
      clearInterval(gameInterval);
      
      
      // Start new round timer after crash
      setTimeout(() => {
        startRoundTimer();
      }, 2000); // Small delay before starting next round timer
    }
  }, 100);
}

// Modify the helper function to use the store's method directly
function startRoundTimer() {
  // Get the store instance rather than the state
  const store = crashGame;
  store.startRoundTimer();
}

export const crashGame = createCrashGameStore();