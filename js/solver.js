import { factorial, isInteger } from './utils.js';

// Allowed operations
const BINARY_OPS = ['+', '-', '*', '/'];
const UNARY_OPS = ['sqrt', '!'];

// Maximum depth for unary operations to prevent infinite loops (e.g. sqrt(sqrt(...)))
const MAX_UNARY_DEPTH = 2;

export class Solver {
    constructor() {
        this.cache = new Map();
    }

    // Generates a set of 4 numbers that can definitely make 10
    generateSolvable() {
        let attempts = 0;
        while (attempts < 1000) {
            const numbers = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)); // 0-9
            this.cache.clear();
            if (this.canMakeTarget(numbers, 10)) {
                return numbers;
            }
            attempts++;
        }
        // Fallback for safety (should rarely happen)
        return [1, 2, 3, 4]; // 1+2+3+4=10
    }

    canMakeTarget(numbers, target) {
        // State representation for caching: sorted values don't work because order matters! 
        // But for "Make 10" with fixed order, we just need to track the current list.
        // Actually, we are simulating the GAME mechanics:
        // 1. Merge adjacent
        // 2. Apply unary to any

        return this.solveRecursive(numbers, target, 0);
    }

    solveRecursive(currentList, target, depth) {
        // Base case
        if (currentList.length === 1) {
            return Math.abs(currentList[0] - target) < 1e-9;
        }

        const stateKey = currentList.join(',') + `|${depth}`;
        if (this.cache.has(stateKey)) return this.cache.get(stateKey);

        // Try Binary Operations (Merge Adjacent)
        for (let i = 0; i < currentList.length - 1; i++) {
            const a = currentList[i];
            const b = currentList[i + 1];

            for (const op of BINARY_OPS) {
                let res;
                if (op === '+') res = a + b;
                if (op === '-') res = a - b; // User can do a - b ? Yes.
                if (op === '*') res = a * b;
                if (op === '/') {
                    if (Math.abs(b) < 1e-9) continue; // Div by zero
                    res = a / b;
                }

                // Create new list
                const newList = [
                    ...currentList.slice(0, i),
                    res,
                    ...currentList.slice(i + 2)
                ];

                if (this.solveRecursive(newList, target, depth)) {
                    this.cache.set(stateKey, true);
                    return true;
                }
            }
        }

        // Try Unary Operations
        // Only try if depth of unary search is low to prevent infinite expanding search space
        // In the game, user can apply unary anytime.
        // For solver, we limit it to avoid complexity.
        // Let's restrict: max 2 unary ops total per branch might be too strict.
        // Let's say: don't apply unary if value doesn't change much or makes it worse?
        // Simple heuristic: Only allow sqrt if perfect square or small? No.
        // Let's limit total steps? No, just limit unary depth per number?
        // Actually, for generation, we can stick to simple logic: 
        // Maybe just Allow 1 Unary op per number in the breakdown?

        // To ensure we generate solvable puzzles, we really just need ONE solution.
        // We can limit solver to minimal unary usage (e.g. max 1 unary op per step)
        // or just don't use unary in generation to guarantee it's possible with basics?
        // NO, the prompt asks for Sqrt/Factorial support. It's better if the solution requires it sometimes.

        /* 
           Complexity check: The recursion with Unary is infinite if not bounded.
           We will BOUND use of unary operators in the solver.
           Only apply unary if the number is "suitable".
           - Factorial: only if integer, 0 <= n <= 6 (since 7! = 5040, likely too big for 10, but possible with division).
           - Sqrt: only if n >= 0.
        */

        if (depth < 4) { // Only allow a few nested logic steps that increase complexity
            for (let i = 0; i < currentList.length; i++) {
                const val = currentList[i];

                // Factorial
                if (isInteger(val) && val >= 0 && val <= 5) { // 6! is 720, acceptable. Limit to 5 (120) for easy.
                    const res = factorial(val);
                    if (res !== val) { // Avoid 1! = 1, 2! = 2 loops if we didn't track "used unary"
                        const newList = [...currentList];
                        newList[i] = res;
                        if (this.solveRecursive(newList, target, depth + 1)) {
                            this.cache.set(stateKey, true);
                            return true;
                        }
                    }
                }

                // Sqrt
                if (val >= 0) {
                    const res = Math.sqrt(val);
                    if (isInteger(res)) { // Heuristic: Only allow Integer Sqrt for generation to keep it "clean"
                        const newList = [...currentList];
                        newList[i] = res;
                        if (this.solveRecursive(newList, target, depth + 1)) {
                            this.cache.set(stateKey, true);
                            return true;
                        }
                    }
                }
            }
        }

        this.cache.set(stateKey, false);
        return false;
    }
}
