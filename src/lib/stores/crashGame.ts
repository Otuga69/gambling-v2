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
  betAmount: number;
  isRunning: boolean;
  isCrashed: boolean;
  userCashedOut: boolean;
  crashPoint: number;
  userWinnings: number;
  gameHistory: number[];
  multiplier: number;
  pointsHistory: GamePoint[];
  error: string | null;
}

// Initialize multiplier store
const multiplier = writable(1.00);

// Initialize game state
const initialState: GameState = {
  userId: null,
  userCoins: 0,
  betAmount: 10,
  isRunning: false,
  isCrashed: false,
  userCashedOut: false,
  crashPoint: 0,
  userWinnings: 0,
  gameHistory: [],
  multiplier: 1.00,
  pointsHistory: [],
  error: null
};

function createCrashGameStore() {
  const { subscribe, set, update } = writable<GameState>(initialState);
  let gameInterval: number | null = null;
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
          // Set bet amount to reasonable default
          const newBetAmount = Math.min(state.betAmount, userData.coins || 0);
          return {
            ...state,
            userId: userId,
            userCoins: userData.coins || 0,
            betAmount: newBetAmount > 0 ? newBetAmount : 1
          };
        });
        
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
    
    setBetAmount: (amount: number) => {
      update(state => ({
        ...state,
        betAmount: amount
      }));
    },
    
    startGame: async (pb: PocketBase) => {
      console.log("Start game triggered with PB available:", !!pb);
      
      if (!pb) {
        console.error("PocketBase instance missing");
        update(state => ({ ...state, error: 'Authentication required' }));
        return;
      }
      
      // Force immediate state update to ensure UI reactivity
      const currentState = get({ subscribe }); // Access the store's current state
      console.log("Current state before game start:", currentState);
      
      if (currentState.isRunning) {
        console.log("Game already running, ignoring start command");
        return;
      }
      
      if (currentState.betAmount <= 0 || currentState.betAmount > currentState.userCoins) {
        console.error(`Invalid bet amount: ${currentState.betAmount}, available coins: ${currentState.userCoins}`);
        update(state => ({
          ...state,
          error: 'Invalid bet amount'
        }));
        return;
      }
      
      try {
        // Mark that we're about to make changes to server
        syncedWithServer = false;
        
        // First update PocketBase with the deducted coins
        if (currentState.userId) {
          // Deduct coins from user in PocketBase
          const newCoinBalance = currentState.userCoins - currentState.betAmount;
          
          try {
            console.log(`Updating user ${currentState.userId} coins to ${newCoinBalance} (deducting bet)`);
            await pb.collection('users').update(currentState.userId, {
              coins: newCoinBalance
            });
            console.log("User coins updated successfully in database (bet deducted)");
          } catch (err) {
            console.error('Failed to update user coins in database:', err);
            syncedWithServer = true; // Reset sync flag
            update(state => ({
              ...state,
              error: 'Failed to place bet'
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
          isRunning: true,
          isCrashed: false,
          userCashedOut: false,
          userCoins: state.userCoins - state.betAmount,
          pointsHistory: [{ x: 0, y: 400 }],
          error: null
        }));
        
        // Now we're in sync with server again
        syncedWithServer = true;
        
        // Reset multiplier
        multiplier.set(1.00);
        
        // Starting the game simulation
        let currentMult = 1.00;
        let crashed = false;
        
        // Generate a crash point using a random algorithm
        // This is a simple implementation - you'd want something more sophisticated in production
        const crashMultiplier = Math.random() < 0.33 ? 
          1 + Math.random() : // 33% chance of crashing early (1.00-2.00x)
          2 + Math.random() * 8; // 67% chance of going higher
        
        // Start game interval
        gameInterval = window.setInterval(() => {
          if (crashed) {
            clearInterval(gameInterval!);
            gameInterval = null;
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
          update(state => {
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
            update(state => {
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
                gameHistory: newHistory
              };
            });
            
            // Stop the interval
            clearInterval(gameInterval!);
            gameInterval = null;
          }
        }, 100);
      } catch (error) {
        console.error('Error starting game:', error);
        syncedWithServer = true; // Reset sync flag
        update(state => ({
          ...state,
          isRunning: false,
          error: 'Failed to start game'
        }));
      }
    },
    
    cashOut: async (pb: PocketBase) => {
      try {
        const currentState = get({ subscribe });
        
        if (!currentState.isRunning || currentState.userCashedOut || currentState.isCrashed) {
          console.log("Cash out ignored - game not in cashable state");
          return;
        }
        
        // Calculate winnings
        const currentMult = currentState.multiplier;
        const winnings = Math.floor(currentState.betAmount * currentMult);
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
      
      // Keep user ID and coins when resetting
      update(state => ({
        ...initialState,
        userId: state.userId,
        userCoins: state.userCoins
      }));
      
      multiplier.set(1);
    },
    
    destroy: () => {
      if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
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
    }
  };
}

export const crashGame = createCrashGameStore();