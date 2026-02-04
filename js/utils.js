export function factorial(n) {
    if (n < 0) return NaN;
    if (n > 20) return Infinity; // Limit to prevent overflow/hanging
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}

export function isInteger(n) {
    return Number.isInteger(n) || (Math.abs(n - Math.round(n)) < 1e-10);
}

// Safe formatting for display
export function formatNumber(n) {
    if (Math.abs(n - Math.round(n)) < 1e-10) return Math.round(n).toString();
    return parseFloat(n.toFixed(4)).toString();
}
