import { Solver } from './solver.js';
import { factorial } from './utils.js';

/* Token Types:
   'number': { value: 5, id: ... } - Fixed (cannot be removed, only moved? No, fixed order for now based on previous constraint, but let's allow inserting around them)
   Actually, "Fixed Order" was a previous constraint. The user now highlights "keep numbers and put operators between".
   Let's keep the numbers as the anchors.
   
   State:
   tokens: [
      { type: 'number', value: 4, id: 'n1' },
      { type: 'op', value: '+' },
      { type: 'number', value: 3, id: 'n2' }
   ]
*/

export class Game {
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
        this.initialNumbers = numbers; // Track original numbers to ensure all are used

        // Initial state: Just the numbers? Or with gaps?
        // Logic: The list is the sequence of tokens.
        // Initially [N1, N2, N3, N4]
        this.tokens = numbers.map((n, idx) => ({
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

    // Insert operator/paren at index
    // Index is semantic: 0=before first token, 1=after first token, etc.
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
        // Find index
        const index = this.tokens.findIndex(t => t.id === id);
        if (index === -1) return;

        // Cannot remove numbers
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
        // 1. Convert tokens to string for evaluation
        // 2. Check for syntax errors (e.g. ++, )(, empty parens)
        // 3. Evaluate result

        let expression = '';
        let displayExpr = ''; // For latex/display
        let balance = 0;
        let validSyntax = true;
        let usedNumbers = 0;

        // Basic Syntax Check & String Building
        try {
            for (let i = 0; i < this.tokens.length; i++) {
                const t = this.tokens[i];

                if (t.type === 'number') usedNumbers++;

                if (t.type === 'paren') {
                    if (t.value === '(') balance++;
                    else balance--;
                }

                if (balance < 0) validSyntax = false; // Closed before open

                let val = t.value;
                if (t.type === 'number') val = t.value;
                else if (t.type === 'unary') {
                    if (t.value === '!') val = '!'; // Maths.js might need conversion, distinct logic below
                    if (t.value === 'sqrt') val = 'sqrt';
                }

                // We'll use a custom evaluator or simple parsing, because standard eval is risky/hard with 'sqrt' position.
                // Actually, 'sqrt' is prefix, '!' is suffix.
                // Let's rely on a proper parse loop or mathjs if we had it. We only have vanilla JS.
                // We need to transform: 
                // 5 ! -> factorial(5)
                // sqrt 5 -> sqrt(5)
                // But user might input: 5 sqrt 5 (syntax error).

                // Let's build a string that JS can evaluate? 
                // "factorial(5)" works if we define function.
                // "Math.sqrt(5)" works.

                // Construct EVAL string:
                if (t.type === 'number') expression += t.value;
                else if (t.value === '+') expression += '+';
                else if (t.value === '-') expression += '-';
                else if (t.value === '*') expression += '*';
                else if (t.value === '/') expression += '/';
                else if (t.value === '(') expression += '(';
                else if (t.value === ')') expression += ')';
                else if (t.value === '!') {
                    // Factorial is tricky in eval() string building because it's suffix.
                    // Standard JS doesn't support 5!.
                    // We need to wrap PREVIOUS term? Hard.
                    // Easier: Post-process or use a parser.
                    // Quick hack: Use a replacement token and RegEx? 
                    // Or just iterate and validate manually.
                    expression += '!';
                }
                else if (t.value === 'sqrt') {
                    expression += 'sqrt'; // Prefix
                }

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
            // Suppress generic syntax errors
            return { valid: false, error: null };
        }
    }

    safeEvaluate(expr) {
        // 1. Handle Sqrt (Prefix) -> Math.sqrt(...)
        // 2. Handle Factorial (Suffix) -> factorial(...)

        // This is a minimal recursive descent parser or tokenizer replacer.
        // Given complexity, let's process tokens directly.

        // Replace 'sqrt' with 'Math.sqrt(' and ensure closing? 
        // No, 'sqrt 4' -> Math.sqrt(4). 'sqrt (4+5)' -> Math.sqrt((4+5)).
        // We need to find the "term" after sqrt.

        // Replace '!' with 'factorial(' wrapping the "term" before.

        // Let's use a Shunting-yard algorithm or similar to handle precedence if we want full robust.
        // Or simpler: Sanitize and eval with helper functions.
        // Issues: 
        // 3 ! -> factorial(3). 
        // (3+2) ! -> factorial((3+2)).

        // Strategy: 
        // Pre-process the token list to wrap factorials and sqrts before joining to string.
        let processed = this.tokens.map(t => ({ ...t })); // Clone

        // Pass 1: Handle Sqrt (Right Associative, Prefix)
        // We need to insert parens? 
        // sqrt 4 -> sqrt(4). 
        // We'll delegate to JS Eval if we format it right: 
        // define `const sqrt = Math.sqrt;` 
        // `sqrt(4)` works. `sqrt 4` (space) fails.
        // So we must ensure user puts parens after sqrt? 
        // Or we force 'sqrt' to imply next token is arg?
        // User Constraint: "User controls parens". 
        // So if user puts "sqrt 4", it's invalid unless we support it.
        // Math convention: sqrt(x) is clearer. 
        // If user keys "sqrt", we should probably insert "sqrt(" ?
        // But user said "I insert parens".
        // Let's support `sqrt(x)` syntax. So `sqrt` token is just a function name.
        // If user writes `sqrt 4`, eval will fail `sqrt 4`. 
        // User MUST write `sqrt(4)`. 
        // Let's assume `sqrt` acts like `Math.sqrt`.

        // Pass 2: Handle Factorial (Suffix)
        // JS doesn't have suffix operator.
        // We must convert `x !` to `factorial(x)`.
        // This is hard with simple eval.

        // Alternative: Use a library? No, raw JS.
        // Let's write a simple postfix calculator (RPN)?
        // Convert Infix to Postfix (Shunting Yard) then eval. Best way.

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
                    operatorStack.pop(); // Pop '('
                    // If top of stack is function (sqrt), pop it too? 
                    // In our case sqrt is treated as operator.
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

        // Format display string (LaTeX)
        // Just join displays? 
        let latex = this.tokens.map(t => {
            if (t.type === 'op' && t.value === '*') return '\\times';
            if (t.type === 'op' && t.value === '/') return '\\div';
            if (t.type === 'unary' && t.value === 'sqrt') return '\\sqrt';
            return t.display;
        }).join(' ');

        // Crude fix for sqrt formatting in LaTeX: \sqrt 4 is not \sqrt{4}.
        // But for "Token Stream", maybe it's fine?
        // Actually, user wants "Symbols between numbers".
        // If we strictly follow tokenstream, `\sqrt 4` renders as SqrtSymbol 4. 
        // It's readable.

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
                latex: latex // For final display if needed
            });
        }
    }
}
