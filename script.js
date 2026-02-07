
// ==========================================
// Utils
// ==========================================
function factorial(n) {
    if (n < 0) return NaN;
    if (n > 20) return Infinity;
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}

function isInteger(n) {
    return Number.isInteger(n) || (Math.abs(n - Math.round(n)) < 1e-10);
}

function formatNumber(n) {
    if (Math.abs(n - Math.round(n)) < 1e-10) return Math.round(n).toString();
    return parseFloat(n.toFixed(4)).toString();
}

// ==========================================
// Solver
// ==========================================
const BINARY_OPS = ['+', '-', '*', '/'];
const UNARY_OPS = ['sqrt', '!'];

class Solver {
    constructor() {
        this.cache = new Map();
    }

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
        return [1, 2, 3, 4];
    }

    canMakeTarget(numbers, target) {
        return this.solveRecursive(numbers, target, 0);
    }

    solveRecursive(currentList, target, depth) {
        if (currentList.length === 1) {
            return Math.abs(currentList[0] - target) < 1e-9;
        }

        const stateKey = currentList.join(',') + `|${depth}`;
        if (this.cache.has(stateKey)) return this.cache.get(stateKey);

        for (let i = 0; i < currentList.length - 1; i++) {
            const a = currentList[i];
            const b = currentList[i + 1];

            for (const op of BINARY_OPS) {
                let res;
                if (op === '+') res = a + b;
                if (op === '-') res = a - b;
                if (op === '*') res = a * b;
                if (op === '/') {
                    if (Math.abs(b) < 1e-9) continue;
                    res = a / b;
                }

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

        if (depth < 4) {
            for (let i = 0; i < currentList.length; i++) {
                const val = currentList[i];

                if (isInteger(val) && val >= 0 && val <= 5) {
                    const res = factorial(val);
                    if (res !== val) {
                        const newList = [...currentList];
                        newList[i] = res;
                        if (this.solveRecursive(newList, target, depth + 1)) {
                            this.cache.set(stateKey, true);
                            return true;
                        }
                    }
                }

                if (val >= 0) {
                    const res = Math.sqrt(val);
                    if (isInteger(res)) {
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

// ==========================================
// Game Logic
// ==========================================
class Game {
    constructor() {
        this.solver = new Solver();
        this.tokens = [];
        this.history = [];
        this.onStateChange = null;
        this.initialNumbers = [];
    }

    init(callback) {
        this.onStateChange = callback;
        this.newGame();
    }

    newGame() {
        const numbers = this.solver.generateSolvable();
        this.initialNumbers = numbers;

        this.tokens = numbers.map((n) => ({
            id: `num-${crypto.randomUUID()}`,
            type: 'number',
            value: n,
            display: n.toString()
        }));

        this.history = [];
        this.emitChange();
    }

    pushHistory() {
        this.history.push(JSON.parse(JSON.stringify(this.tokens)));
    }

    undo() {
        if (this.history.length === 0) return;
        this.tokens = this.history.pop();
        this.emitChange();
    }

    insert(index, opValue) {
        this.pushHistory();

        const type = ['+', '-', '*', '/'].includes(opValue) ? 'op' :
            ['(', ')'].includes(opValue) ? 'paren' :
                ['sqrt', '!'].includes(opValue) ? 'unary' : 'unknown';

        const newToken = {
            id: `op-${crypto.randomUUID()}`,
            type: type,
            value: opValue,
            display: this.getDisplay(opValue)
        };

        this.tokens.splice(index, 0, newToken);
        this.emitChange();
    }

    remove(id) {
        const index = this.tokens.findIndex(t => t.id === id);
        if (index === -1) return;
        if (this.tokens[index].type === 'number') return;

        this.pushHistory();
        this.tokens.splice(index, 1);
        this.emitChange();
    }

    getDisplay(op) {
        if (op === 'sqrt') return '√';
        if (op === '*') return '×';
        if (op === '/') return '÷';
        return op;
    }

    validateAndEvaluate() {
        let expression = '';
        let balance = 0;
        let validSyntax = true;
        let usedNumbers = 0;

        try {
            for (let i = 0; i < this.tokens.length; i++) {
                const t = this.tokens[i];

                if (t.type === 'number') usedNumbers++;

                if (t.type === 'paren') {
                    if (t.value === '(') balance++;
                    else balance--;
                }

                if (balance < 0) validSyntax = false;

                if (t.type === 'number') expression += t.value;
                else if (t.value === '+') expression += '+';
                else if (t.value === '-') expression += '-';
                else if (t.value === '*') expression += '*';
                else if (t.value === '/') expression += '/';
                else if (t.value === '(') expression += '(';
                else if (t.value === ')') expression += ')';
                else if (t.value === '!') expression += '!';
                else if (t.value === 'sqrt') expression += 'sqrt';

                expression += ' ';
            }
        } catch (e) {
            validSyntax = false;
        }

        if (balance !== 0) return { valid: false, error: '괄호가 닫히지 않았습니다.' };
        if (usedNumbers !== 4) return { valid: false, error: '숫자가 4개여야 합니다.' };

        try {
            const result = this.safeEvaluate(expression);
            return { valid: true, result: result, expression: expression };
        } catch (e) {
            return { valid: false, error: null };
        }
    }

    safeEvaluate(expr) {
        const rpn = this.shuntingYard(this.tokens);
        return this.evaluateRPN(rpn);
    }

    shuntingYard(tokens) {
        const outputQueue = [];
        const operatorStack = [];
        const precedence = {
            'sqrt': 4, '!': 4,
            '*': 3, '/': 3,
            '+': 2, '-': 2,
            '(': 1
        };
        const associativity = {
            'sqrt': 'Right', '!': 'Left',
            '*': 'Left', '/': 'Left',
            '+': 'Left', '-': 'Left'
        };

        tokens.forEach(token => {
            if (token.type === 'number') {
                outputQueue.push(token.value);
            } else if (token.type === 'op' || token.type === 'unary') {
                const op1 = token.value;
                while (operatorStack.length > 0) {
                    const op2 = operatorStack[operatorStack.length - 1];
                    if (op2 === '(') break;

                    if ((associativity[op1] === 'Left' && precedence[op1] <= precedence[op2]) ||
                        (associativity[op1] === 'Right' && precedence[op1] < precedence[op2])) {
                        outputQueue.push(operatorStack.pop());
                    } else {
                        break;
                    }
                }
                operatorStack.push(op1);
            } else if (token.value === '(') {
                operatorStack.push('(');
            } else if (token.value === ')') {
                while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') {
                    outputQueue.push(operatorStack.pop());
                }
                if (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] === '(') {
                    operatorStack.pop();
                } else {
                    throw new Error("Mismatched Parentheses");
                }
            }
        });

        while (operatorStack.length > 0) {
            const op = operatorStack.pop();
            if (op === '(') throw new Error("Mismatched Parentheses");
            outputQueue.push(op);
        }

        return outputQueue;
    }

    evaluateRPN(rpn) {
        const stack = [];
        rpn.forEach(token => {
            if (typeof token === 'number') {
                stack.push(token);
            } else {
                if (token === '!') {
                    if (stack.length < 1) throw new Error("Syntax Error");
                    const a = stack.pop();
                    stack.push(factorial(a));
                } else if (['+', '-', '*', '/'].includes(token)) {
                    if (stack.length < 2) throw new Error("Syntax Error");
                    const b = stack.pop();
                    const a = stack.pop();
                    if (token === '+') stack.push(a + b);
                    else if (token === '-') stack.push(a - b);
                    else if (token === '*') stack.push(a * b);
                    else if (token === '/') {
                        if (Math.abs(b) < 1e-9) throw new Error("Division by Zero");
                        stack.push(a / b);
                    }
                } else if (token === 'sqrt') {
                    if (stack.length < 1) throw new Error("Syntax Error");
                    const a = stack.pop();
                    if (a < 0) throw new Error("Negative Sqrt");
                    stack.push(Math.sqrt(a));
                }
            }
        });

        if (stack.length !== 1) throw new Error("Invalid Expression");
        return stack[0];
    }

    emitChange() {
        const validation = this.validateAndEvaluate();

        let latex = this.tokens.map(t => {
            if (t.type === 'op' && t.value === '*') return '\\times';
            if (t.type === 'op' && t.value === '/') return '\\div';
            if (t.type === 'unary' && t.value === 'sqrt') return '\\sqrt';
            return t.display;
        }).join(' ');

        let won = false;
        if (validation.valid && Math.abs(validation.result - 10) < 1e-9) {
            won = true;
        }

        if (this.onStateChange) {
            this.onStateChange({
                tokens: this.tokens,
                canUndo: this.history.length > 0,
                won: won,
                valid: validation.valid,
                error: validation.valid ? null : validation.error,
                result: validation.valid ? validation.result : null,
                latex: latex
            });
        }
    }
}

// ==========================================
// Main Execution
// ==========================================
const game = new Game();
const boardEl = document.getElementById('game-board');
const undoBtn = document.getElementById('undo-btn');
const newGameBtn = document.getElementById('new-game-btn');
const resetBtn = document.getElementById('reset-btn');
const winModal = document.getElementById('win-modal');
const finalExprEl = document.getElementById('final-expression');
const nextLevelBtn = document.getElementById('next-level-btn');

function render(state) {
    boardEl.innerHTML = '';
    createDropZone(0);

    state.tokens.forEach((token, index) => {
        const tokenEl = document.createElement('div');

        if (token.type === 'number') {
            tokenEl.className = 'card token-number';
            tokenEl.innerHTML = `<span class="value">${token.display}</span>`;
        } else if (token.type === 'op' || token.type === 'paren' || token.type === 'unary') {
            tokenEl.className = 'token-op';
            tokenEl.textContent = token.display;
            tokenEl.setAttribute('data-id', token.id);

            tokenEl.addEventListener('click', () => {
                game.remove(token.id);
            });
            tokenEl.title = "클릭하여 제거";
        }

        boardEl.appendChild(tokenEl);
        createDropZone(index + 1);
    });

    undoBtn.disabled = !state.canUndo;

    const existingError = document.getElementById('error-msg');
    if (existingError) existingError.remove();

    if (state.valid === false && state.error) {
        const errorEl = document.createElement('div');
        errorEl.id = 'error-msg';
        errorEl.textContent = state.error;
        document.querySelector('main').appendChild(errorEl);
    }

    if (state.won) {
        showWin(state.latex);
    }
}

function createDropZone(index) {
    const dropZone = document.createElement('div');
    dropZone.className = 'drop-zone';
    dropZone.dataset.index = index;

    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    boardEl.appendChild(dropZone);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const op = e.dataTransfer.getData('text/plain');
    const index = parseInt(e.currentTarget.dataset.index);

    if (op && !isNaN(index)) {
        game.insert(index, op);
    }
}

document.querySelectorAll('.palette-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', item.dataset.op);
    });
});

function showWin(expr) {
    winModal.classList.remove('hidden');
    if (window.katex) {
        katex.render(`${expr} = 10`, finalExprEl, { throwOnError: false, displayMode: true });
    } else {
        finalExprEl.textContent = expr + " = 10";
    }
}

function hideWin() {
    winModal.classList.add('hidden');
}

undoBtn.addEventListener('click', () => game.undo());
resetBtn.addEventListener('click', () => {
    while (game.history.length > 0) game.undo();
});
newGameBtn.addEventListener('click', () => game.newGame());
nextLevelBtn.addEventListener('click', () => {
    hideWin();
    game.newGame();
});

game.init(render);
