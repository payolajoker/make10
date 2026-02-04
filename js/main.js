import { Game } from './game.js';

const game = new Game();
const boardEl = document.getElementById('game-board');
const undoBtn = document.getElementById('undo-btn');
const newGameBtn = document.getElementById('new-game-btn');
const resetBtn = document.getElementById('reset-btn');
const winModal = document.getElementById('win-modal');
const finalExprEl = document.getElementById('final-expression');
const nextLevelBtn = document.getElementById('next-level-btn');

// --- Rendering ---

function render(state) {
    boardEl.innerHTML = '';

    // Check validation error (if any)
    // We could show it in a toast or below board.
    // For now, let's just log or visually indicate block validity if needed.
    // But requirement says "Show error if parens not closed".

    // Let's iterate tokens and dropzones.
    // DropZone 0
    createDropZone(0);

    state.tokens.forEach((token, index) => {
        // Create Token Element
        const tokenEl = document.createElement('div');

        if (token.type === 'number') {
            tokenEl.className = 'card token-number';
            tokenEl.innerHTML = `<span class="value">${token.display}</span>`;
        } else if (token.type === 'op' || token.type === 'paren' || token.type === 'unary') {
            tokenEl.className = 'token-op';
            tokenEl.textContent = token.display;
            tokenEl.setAttribute('data-id', token.id);

            // Click to remove (only operators)
            tokenEl.addEventListener('click', () => {
                game.remove(token.id);
            });
            tokenEl.title = "클릭하여 제거";
        }

        boardEl.appendChild(tokenEl);

        // DropZone after this token (index + 1)
        createDropZone(index + 1);
    });

    // Update Controls
    undoBtn.disabled = !state.canUndo;

    // Win/Error Feedback
    const existingError = document.getElementById('error-msg');
    if (existingError) existingError.remove();

    if (state.valid === false && state.error) {
        const errorEl = document.createElement('div');
        errorEl.id = 'error-msg';
        errorEl.textContent = state.error;
        document.querySelector('main').appendChild(errorEl);
        // Style it in CSS
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

// --- Drag & Drop Handlers ---

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

// Palette Draggables
document.querySelectorAll('.palette-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', item.dataset.op);
    });
});

// --- Other interactions ---

function showWin(expr) {
    winModal.classList.remove('hidden');
    // Using KaTeX if available
    if (window.katex) {
        katex.render(`${expr} = 10`, finalExprEl, { throwOnError: false, displayMode: true });
    } else {
        finalExprEl.textContent = expr + " = 10";
    }
}

function hideWin() {
    winModal.classList.add('hidden');
}

// --- Init ---

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
