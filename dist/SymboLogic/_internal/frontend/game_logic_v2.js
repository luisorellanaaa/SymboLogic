// --- Modo 100% Offline Persistente (Python API) ---
let currentUser = null;
let currentRole = 'user';
let gameData = { users: {}, scores: [] };

window.addEventListener('pywebviewready', async () => {
    try {
        gameData = await window.pywebview.api.get_data();
        if (!gameData.questionsConjuntos || gameData.questionsConjuntos.length === 0) {
            gameData.questionsConjuntos = [...questionsConjuntos];
        }
        if (!gameData.questionsLogica || gameData.questionsLogica.length === 0) {
            gameData.questionsLogica = [...questionsLogica];
        }
        
        // Cargar tema guardado
        const isDark = gameData.theme === 'dark';
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        
        // Actualizar barra de título nativa
        if (window.pywebview && window.pywebview.api && window.pywebview.api.change_titlebar_theme) {
            window.pywebview.api.change_titlebar_theme(isDark);
        }

        // Utilidad para normalizar nombres (remover tildes, espacios y forzar minúsculas)
        const normalizeUsername = (str) => {
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, '');
        };

        // Limpiar base de datos de usuarios duplicados (por mayúsculas/espacios antiguos)
        const newUsers = {};
        Object.keys(gameData.users).forEach(k => {
            const cleanKey = normalizeUsername(k);
            // Mantener el rol de admin si hay conflicto
            if (newUsers[cleanKey] && newUsers[cleanKey].role === 'admin') {
                return;
            }
            newUsers[cleanKey] = gameData.users[k];
        });
        gameData.users = newUsers;

        saveData();
    } catch (e) {
        console.error("Error loading data", e);
    }
});

const saveData = () => {
    if (window.pywebview && window.pywebview.api) {
        window.pywebview.api.save_data(gameData);
    }
};

// --- Utilidades UI ---
const escapeHTML = (str) => {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
};

const showNotification = (message, type = 'success') => {
    const container = document.getElementById('notification-container');
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerHTML = message;
    container.appendChild(notif);

    setTimeout(() => {
        notif.style.animation = 'slideOut 0.3s forwards';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
};

const switchPanel = (panelId) => {
    document.querySelectorAll('section').forEach(sec => {
        if (sec.id !== panelId) {
            sec.classList.remove('active');
            setTimeout(() => sec.classList.add('hidden'), 400);
        }
    });

    const target = document.getElementById(panelId);
    target.classList.remove('hidden');
    setTimeout(() => target.classList.add('active'), 50);
    
    // Toggle copyright text
    const copyright = document.getElementById('copyright-text');
    if (copyright) {
        if (panelId === 'login-screen') {
            copyright.classList.remove('hidden');
        } else {
            copyright.classList.add('hidden');
        }
    }
};

let authMode = 'login';
const switchTab = (mode) => {
    // Limpiar campos si pasamos de Ingresar a Registrarse
    if (mode === 'register' && authMode === 'login') {
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    }

    authMode = mode;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    const btn = document.getElementById('submit-btn');
    if (mode === 'register') {
        btn.textContent = 'Registrarse';
    } else {
        btn.textContent = 'Entrar';
    }
};

// --- Autenticación Offline ---
const handleAuth = (e) => {
    e.preventDefault();
    let rawUsername = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if (!rawUsername || !password) {
        showNotification("Completa los campos", "error");
        return;
    }

    const normalizeUsername = (str) => {
        if (!str) return '';
        return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, '');
    };

    const username = normalizeUsername(rawUsername);

    if (authMode === 'register') {
        // Validar que la contraseña no sea igual o muy similar al nombre de usuario
        if (password.toLowerCase() === rawUsername.toLowerCase()) {
            showNotification('La contraseña no puede ser igual al usuario', 'error');
            return;
        }
        
        if (rawUsername.length >= 3 && password.toLowerCase().includes(rawUsername.toLowerCase())) {
            showNotification('La contraseña es demasiado similar al usuario', 'error');
            return;
        }
        
        // Redundancia extrema de verificación
        let userExists = false;
        
        // 1. Verificación directa (por si el key es idéntico)
        if (gameData.users[rawUsername] || gameData.users[username] || gameData.users[rawUsername.trim()] || gameData.users[rawUsername.toLowerCase()]) {
            userExists = true;
        }

        // 2. Verificación profunda iterando cada propiedad
        for (let key in gameData.users) {
            if (Object.prototype.hasOwnProperty.call(gameData.users, key)) {
                if (normalizeUsername(key) === username || key.toLowerCase() === rawUsername.toLowerCase()) {
                    userExists = true;
                    break;
                }
            }
        }

        if (userExists) {
            showNotification('Ese nombre de usuario ya está registrado', 'error');
            return; // Detener ejecución inmediatamente
        }
        
        // Si sobrevivió a las comprobaciones, crear el usuario
        gameData.users[username] = { password: password, role: 'user', coins: 5, puzzlePieces: [] };
        saveData();
        showNotification('Registro exitoso. Ahora puedes ingresar.');
        switchTab('login');
    } else {
        // Encontrar la llave real para login (ya que podría estar guardado con mayúsculas por error previo)
        let loginKey = username;
        for (let key in gameData.users) {
            if (normalizeUsername(key) === username) {
                loginKey = key;
                break;
            }
        }
        
        if (gameData.users[loginKey] && gameData.users[loginKey].password === password) {
            currentUser = loginKey;
            currentRole = gameData.users[loginKey].role;
            document.getElementById('user-display').textContent = currentUser + (currentRole === 'admin' ? ' (Admin)' : '');
            
            // Mostrar botón Admin si corresponde
            const btnAdmin = document.getElementById('btn-admin-panel');
            if (btnAdmin) {
                if (currentRole === 'admin') btnAdmin.classList.remove('hidden');
                else btnAdmin.classList.add('hidden');
            }

            if (typeof gameData.users[loginKey].coins !== 'number' || isNaN(gameData.users[loginKey].coins)) {
                gameData.users[loginKey].coins = 5; // Regalo retroactivo a usuarios antiguos
            }
            if (!gameData.users[loginKey].puzzlePieces) {
                gameData.users[loginKey].puzzlePieces = [];
            }
            saveData();
            updateCoinsUI();

            showNotification(`Bienvenido, ${username}!`);
            switchPanel('main-menu');
        } else {
            showNotification('Credenciales incorrectas', 'error');
        }
    }
};

const logout = () => {
    currentUser = null;
    currentRole = 'user';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    switchPanel('login-screen');
};

const updateCoinsUI = () => {
    if (!currentUser || !gameData.users[currentUser]) return;
    const coins = gameData.users[currentUser].coins || 0;
    const coinsDisp = document.getElementById('coins-display');
    const gameCoinsDisp = document.getElementById('game-coins-display');
    if (coinsDisp) coinsDisp.textContent = coins;
    if (gameCoinsDisp) gameCoinsDisp.textContent = coins;
};

// --- Lógica del Juego ---
let gameMode = '';
let gameSubMode = 'standard';
let score = 0;
let timeLeft = 60;
let timerInterval;
let lastQuestionIndex = -1;
let timePowerUses = 0;
let currentLives = 3;

const setSubMode = (mode) => {
    gameSubMode = mode;
    document.querySelectorAll('.submode-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.getElementById('tab-' + mode);
    if (activeTab) activeTab.classList.add('active');
};

const questionsConjuntos = [
    { q: "A = {1, 2, 3}, B = {3, 4, 5}. ¿Cuál es A ∪ B?", options: ["{1, 2, 3, 4, 5}", "{3}", "{1, 2}", "{4, 5}"], answer: 0 },
    { q: "A = {a, b, c}, B = {b, c, d}. ¿Cuál es A ∩ B?", options: ["{a, d}", "{b, c}", "{a, b, c, d}", "Ø"], answer: 1 },
    { q: "A = {1, 2}, B = {1, 2, 3}. ¿Es A ⊆ B?", options: ["Verdadero", "Falso", "Depende del universo", "No se puede saber"], answer: 0 },
    { q: "A = {x, y, z}, B = {x, y}. ¿Cuál es A - B?", options: ["{x}", "{z}", "Ø", "{y}"], answer: 1 },
    { q: "A = {1, 2}, B = {3, 4}. ¿Cuál es A ∩ B?", options: ["{1, 2, 3, 4}", "Ø", "{1, 3}", "{2, 4}"], answer: 1 },
    { q: "Si A tiene 3 elementos, ¿cuántos subconjuntos tiene?", options: ["3", "6", "8", "9"], answer: 2 },
    { q: "U = {1, 2, 3, 4, 5}, A = {1, 2}. ¿Cuál es el complemento de A?", options: ["{3, 4, 5}", "{1, 2}", "U", "Ø"], answer: 0 },
    { q: "¿Qué representa el símbolo Ø en teoría de conjuntos?", options: ["Conjunto Universal", "Conjunto Vacío", "Intersección", "Subconjunto"], answer: 1 },
    { q: "Si A ∩ B = Ø, entonces A y B son conjuntos:", options: ["Iguales", "Disjuntos", "Complementarios", "Universales"], answer: 1 },
    { q: "La diferencia simétrica A △ B es equivalente a:", options: ["(A ∪ B) - (A ∩ B)", "(A ∩ B) - (A ∪ B)", "A - B", "A ∪ B"], answer: 0 },
    { q: "Si A ⊆ B y B ⊆ A, entonces:", options: ["A = B", "A ∩ B = Ø", "A - B = A", "B - A = B"], answer: 0 },
    { q: "A = {2, 4, 6}, B = {1, 2, 3}. ¿Cuál es B - A?", options: ["{4, 6}", "{1, 3}", "{1, 2, 3, 4, 6}", "Ø"], answer: 1 },
    { q: "¿Cuál es el cardinal del conjunto A = {a, e, i, o, u}?", options: ["4", "5", "6", "Infinito"], answer: 1 },
    { q: "La unión de un conjunto A con su complemento A' da como resultado:", options: ["Conjunto Vacío", "Conjunto A", "Conjunto Universal", "A'"], answer: 2 },
    { q: "La intersección de un conjunto A con el conjunto vacío es:", options: ["Conjunto Universal", "Conjunto A", "Conjunto Vacío", "Indefinido"], answer: 2 },
    { q: "Si el cardinal de A es 4, el conjunto potencia P(A) tiene un cardinal de:", options: ["4", "8", "16", "32"], answer: 2 },
    { q: "A = {x | x es par}, B = {x | x es impar}. A ∩ B es:", options: ["Números Naturales", "Ø", "Números Enteros", "Números Racionales"], answer: 1 },
    { q: "A = {1, 2}. ¿Cuál de los siguientes pertenece a P(A)?", options: ["{1, 2, 3}", "3", "{1}", "Ninguno"], answer: 2 },
    { q: "Si A ∪ Ø = A, esta propiedad se conoce como:", options: ["Idempotencia", "Identidad", "Absorción", "Conmutativa"], answer: 1 },
    { q: "(A ∪ B)' = A' ∩ B' es la ley de:", options: ["Asociatividad", "Distributividad", "De Morgan", "Complemento"], answer: 2 }
];

const questionsLogica = [
    { q: "¿Cuál de las siguientes es equivalente a ¬(P ∧ Q) según las Leyes de De Morgan?", options: ["¬P ∨ ¬Q", "¬P ∧ ¬Q", "P ∨ Q", "P ∧ Q"], answer: 0 },
    { q: "En lógica proposicional, una expresión que siempre es verdadera se conoce como:", options: ["Tautología", "Contradicción", "Contingencia", "Falacia"], answer: 0 },
    { q: "Para que la implicación (P → Q) sea falsa, ¿qué debe cumplirse?", options: ["P es V y Q es F", "P es F y Q es V", "Ambas son F", "Ambas son V"], answer: 0 },
    { q: "La regla 'Modus Ponens' establece que a partir de (P → Q) y (P), se deduce:", options: ["Q", "¬Q", "¬P", "P ∧ Q"], answer: 0 },
    { q: "¿Qué símbolo se utiliza para representar la disyunción inclusiva ('O')?", options: ["∨", "∧", "→", "↔"], answer: 0 },
    { q: "La doble negación ¬(¬P) es lógicamente equivalente a:", options: ["P", "Falso", "Verdadero", "P ∧ ¬P"], answer: 0 },
    { q: "Si (P ↔ Q) es verdadero, ¿qué concluimos sobre P y Q?", options: ["Tienen el mismo valor", "Son diferentes", "Ambas son falsas", "Ambas son verdaderas"], answer: 0 },
    { q: "La proposición (P ∧ ¬P) es un ejemplo clásico de:", options: ["Contradicción", "Tautología", "Axioma", "Implicación"], answer: 0 },
    { q: "Si P es V y Q es V, el valor de verdad de P ∨ ¬Q es:", options: ["Falso", "Verdadero", "Indeterminado", "Contradicción"], answer: 1 },
    { q: "Si P → Q es Verdadero, P se llama:", options: ["Consecuente", "Antecedente", "Conclusión", "Premisa Mayor"], answer: 1 },
    { q: "La regla 'Modus Tollens' infiere ¬P a partir de (P → Q) y:", options: ["P", "Q", "¬Q", "P ∨ Q"], answer: 2 },
    { q: "La expresión P ∨ P es equivalente a P. ¿Cómo se llama esta propiedad?", options: ["Idempotencia", "Conmutativa", "Asociativa", "Distributiva"], answer: 0 },
    { q: "¿Cuál es el resultado de V ↔ F?", options: ["Verdadero", "Falso", "Depende", "Ambas"], answer: 1 },
    { q: "¿Qué nombre recibe el conectivo ∧?", options: ["Disyunción", "Conjunción", "Implicación", "Negación"], answer: 1 },
    { q: "La proposición ¬(P ∨ Q) es equivalente a:", options: ["¬P ∧ ¬Q", "¬P ∨ ¬Q", "P ∧ Q", "P ∨ Q"], answer: 0 },
    { q: "Una proposición que puede ser Verdadera o Falsa dependiendo de la interpretación es una:", options: ["Tautología", "Contradicción", "Contingencia", "Falacia"], answer: 2 },
    { q: "Si P=F y Q=F, ¿Cuál es el valor de P → Q?", options: ["Verdadero", "Falso", "Indeterminado", "Nulo"], answer: 0 },
    { q: "El silogismo disyuntivo a partir de (P ∨ Q) y ¬P, deduce:", options: ["¬Q", "P", "Q", "P ∧ Q"], answer: 2 },
    { q: "¿Cuál conectivo lógico corresponde a la frase 'Si y sólo si'?", options: ["→", "↔", "∧", "∨"], answer: 1 },
    { q: "P → Q es lógicamente equivalente a:", options: ["¬P ∨ Q", "P ∨ ¬Q", "¬P ∧ Q", "P ∧ ¬Q"], answer: 0 }
];

const startTimer = () => {
    if (gameSubMode === 'practice' || gameSubMode === 'muerte') return;
    
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('time-display').textContent = timeLeft;
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
};

const startGame = (mode) => {
    clearInterval(timerInterval); // Prevenir múltiples intervalos
    gameMode = mode;
    score = 0;
    
    // Configurar tiempo inicial según sub-modo
    if (gameSubMode === 'survival') {
        timeLeft = 15;
    } else if (gameSubMode === 'practice') {
        timeLeft = '∞';
    } else if (gameSubMode === 'muerte') {
        currentLives = 3;
        timeLeft = '❤️❤️❤️';
    } else {
        timeLeft = 60;
    }
    
    timePowerUses = 0;
    
    document.getElementById('current-score').textContent = score;
    
    if (gameSubMode === 'muerte') {
        document.getElementById('game-status-display').innerHTML = `Vidas: <span id="time-display">${timeLeft}</span>`;
    } else {
        document.getElementById('game-status-display').innerHTML = `Tiempo: <span id="time-display">${timeLeft}</span>${gameSubMode === 'practice' ? '' : 's'}`;
    }
    
    switchPanel('game-screen');
    updateCoinsUI();
    
    startTimer();
    
    // Reactivar poderes visualmente excepto en Práctica donde podríamos desactivarlos si se desea (los dejaremos pero Time Power no hará nada en Práctica)
    document.querySelectorAll('.power-btn').forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
    });

    nextQuestion();
};

const nextQuestion = () => {
    const questions = gameMode === 'conjuntos' ? gameData.questionsConjuntos : gameData.questionsLogica;
    
    let qIndex;
    do {
        qIndex = Math.floor(Math.random() * questions.length);
    } while (qIndex === lastQuestionIndex && questions.length > 1);
    
    lastQuestionIndex = qIndex;
    const q = questions[qIndex];

    const qContainer = document.getElementById('game-content');
    qContainer.innerHTML = '';
    const qDiv = document.createElement('div');
    qDiv.className = 'game-question';
    qDiv.textContent = q.q;
    qContainer.appendChild(qDiv);
    
    const controls = document.getElementById('game-controls');
    controls.className = `game-controls grid-${q.options.length}`;
    controls.innerHTML = '';

    // Mapear opciones con su estado correcto original
    let shuffledOptions = q.options.map((opt, idx) => {
        return { text: opt, isCorrect: idx === q.answer };
    });

    // Mezclar aleatoriamente (Algoritmo Fisher-Yates)
    for (let i = shuffledOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
    }

    // Renderizar botones mezclados
    shuffledOptions.forEach((optObj) => {
        const btn = document.createElement('button');
        btn.className = 'game-btn';
        btn.textContent = optObj.text;
        if (optObj.isCorrect) btn.dataset.correct = "true";
        btn.onclick = () => handleAnswer(optObj.isCorrect);
        controls.appendChild(btn);
    });

    const hintBtn = document.getElementById('btn-power-5050');
    if (hintBtn) {
        hintBtn.disabled = false;
        hintBtn.style.opacity = '1';
    }
};

const handleAnswer = (isCorrect) => {
    if (isCorrect) {
        if (gameSubMode !== 'practice') {
            score += 10;
            if (gameData.users[currentUser]) {
                let currentCoins = parseInt(gameData.users[currentUser].coins);
                if (isNaN(currentCoins)) currentCoins = 0;
                gameData.users[currentUser].coins = currentCoins + 1;
                saveData();
                updateCoinsUI();
            }
        }
        
        if (gameSubMode === 'survival') {
            timeLeft += 3;
            showNotification('+10 Puntos | +3s Tiempo', 'success');
            document.getElementById('time-display').textContent = timeLeft;
        } else if (gameSubMode === 'practice') {
            showNotification('¡Correcto!', 'success');
        } else {
            showNotification('+10 Puntos | +1 Moneda', 'success');
        }
        
        document.getElementById('current-score').textContent = score;
        nextQuestion();
    } else {
        if (gameSubMode === 'survival') {
            timeLeft -= 2;
            showNotification('Incorrecto! -2s', 'error');
        } else if (gameSubMode === 'practice') {
            showNotification('Incorrecto, inténtalo de nuevo', 'error');
        } else if (gameSubMode === 'muerte') {
            currentLives--;
            let livesStr = '❤️'.repeat(currentLives) + '🤍'.repeat(3 - currentLives);
            document.getElementById('time-display').textContent = livesStr;
            showNotification('¡Incorrecto! -1 Vida', 'error');
            if (currentLives <= 0) {
                endGame();
            }
            return;
        } else {
            timeLeft -= 5;
            showNotification('Incorrecto! -5s', 'error');
        }
        
        if (gameSubMode !== 'practice' && gameSubMode !== 'muerte') {
            document.getElementById('time-display').textContent = timeLeft;
            if (timeLeft <= 0) {
                endGame();
            }
        }
    }
};

const endGame = () => {
    clearInterval(timerInterval);
    showNotification(`Juego terminado. Puntaje: ${score}`);
    
    if (gameSubMode !== 'practice') {
        // Lógica del Rompecabezas
        if (score >= 50 && currentUser && gameData.users[currentUser]) {
            if (!gameData.users[currentUser].puzzlePieces) gameData.users[currentUser].puzzlePieces = [];
            const myPieces = gameData.users[currentUser].puzzlePieces;
            const missingPieces = [];
            for (let i = 0; i < 9; i++) {
                if (!myPieces.includes(i)) missingPieces.push(i);
            }
            if (missingPieces.length > 0) {
                const randomPiece = missingPieces[Math.floor(Math.random() * missingPieces.length)];
                gameData.users[currentUser].puzzlePieces.push(randomPiece);
                showNotification(`¡Desbloqueaste una nueva pieza del rompecabezas!`, 'success');
            }
        }
        
        saveScoreOffline(gameMode, score);
    }
    
    exitGame();
};

const exitGame = () => {
    clearInterval(timerInterval);
    switchPanel('main-menu');
};

const usePower = (type) => {
    if (!currentUser || !gameData.users[currentUser]) return;
    
    let cost = 0;
    if (type === '5050') cost = 2;
    if (type === 'time') cost = 1;
    if (type === 'skip') cost = 3;

    if (gameData.users[currentUser].coins < cost) {
        showNotification(`No tienes suficientes monedas (Cuesta ${cost})`, 'error');
        return;
    }

    if (type === '5050') {
        const controls = document.getElementById('game-controls');
        const buttons = Array.from(controls.children);
        const incorrectBtns = buttons.filter(btn => btn.dataset.correct !== "true" && btn.style.visibility !== 'hidden');
        
        if (incorrectBtns.length < 2) {
            showNotification('Ya usaste este poder en esta pregunta', 'error');
            return;
        }

        gameData.users[currentUser].coins -= cost;
        let hiddenCount = 0;
        for (let i = 0; i < incorrectBtns.length; i++) {
            if (hiddenCount < 2) {
                incorrectBtns[i].style.visibility = 'hidden';
                hiddenCount++;
            }
        }
        
        const btn = document.getElementById('btn-power-5050');
        btn.disabled = true;
        btn.style.opacity = '0.5';
        showNotification('-2 Monedas | 50/50 Activado', 'success');

    } else if (type === 'time') {
        if (gameSubMode === 'muerte' || gameSubMode === 'practice') {
            showNotification('Este poder no aplica en este modo', 'error');
            return;
        }
        if (timePowerUses >= 3) {
            showNotification('Límite de tiempo alcanzado (Máx 3 por partida)', 'error');
            return;
        }
        gameData.users[currentUser].coins -= cost;
        timeLeft += 15;
        timePowerUses++;
        document.getElementById('time-display').textContent = timeLeft;
        showNotification('-1 Moneda | +15 Segundos', 'success');

    } else if (type === 'skip') {
        gameData.users[currentUser].coins -= cost;
        showNotification('-3 Monedas | Pregunta Saltada', 'success');
        nextQuestion();
    }

    saveData();
    updateCoinsUI();
};

// --- Manual del Juego ---
const showManual = () => {
    document.getElementById('manual-modal').classList.remove('hidden');
    document.getElementById('manual-modal').classList.add('active');
};

const closeManual = () => {
    document.getElementById('manual-modal').classList.remove('active');
    document.getElementById('manual-modal').classList.add('hidden');
};

// --- Guardado de Puntaje Local ---
const saveScoreOffline = (mode, points) => {
    if (!points) return;
    
    // Encontrar todos los puntajes del usuario en este modo
    let userScores = gameData.scores.filter(s => s.username === currentUser && s.mode === mode);
    
    // Obtener el puntaje máximo histórico (o el actual si es mayor)
    let maxScore = points;
    if (userScores.length > 0) {
        let maxHist = Math.max(...userScores.map(s => s.score));
        if (maxHist > maxScore) maxScore = maxHist;
    }
    
    // Remover TODOS los puntajes viejos de este usuario en este modo
    gameData.scores = gameData.scores.filter(s => !(s.username === currentUser && s.mode === mode));
    
    // Agregar un único registro maestro
    gameData.scores.push({
        username: currentUser,
        mode: mode,
        score: maxScore,
        date: new Date().toISOString()
    });
    
    saveData();
};

// --- Leaderboard Local ---
const showLeaderboard = () => {
    switchPanel('leaderboard-screen');
    const listConjuntos = document.getElementById('leaderboard-list-conjuntos');
    const listLogica = document.getElementById('leaderboard-list-logica');
    
    const scores = [...gameData.scores];
    scores.sort((a, b) => b.score - a.score);
    
    const topConjuntos = scores.filter(s => s.mode === 'conjuntos').slice(0, 3);
    const topLogica = scores.filter(s => s.mode === 'logica').slice(0, 3);
    
    const renderList = (top3, container) => {
        container.innerHTML = '';
        if (top3.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); font-size: 0.9rem;">Aún no hay puntuaciones.</div>';
            return;
        }
        top3.forEach((item, idx) => {
            container.innerHTML += `
                <div class="leader-item">
                    <div class="leader-rank">#${idx + 1}</div>
                    <div style="flex-grow: 1; padding-left: 10px;">
                        <strong style="color: var(--text-primary);">${escapeHTML(item.username)}</strong>
                    </div>
                    <div style="font-size: 1.3rem; font-weight: bold; color: var(--primary)">${item.score} <span style="font-size:0.8rem; font-weight:normal;">pts</span></div>
                </div>
            `;
        });
    };

    renderList(topConjuntos, listConjuntos);
    renderList(topLogica, listLogica);
};

const hideLeaderboard = () => {
    switchPanel('main-menu');
};

// --- Lógica del Rompecabezas ---
const showPuzzle = () => {
    switchPanel('puzzle-screen');
    const grid = document.getElementById('puzzle-grid');
    grid.innerHTML = '';
    if (!currentUser || !gameData.users[currentUser]) return;
    
    if (!gameData.users[currentUser].puzzlePieces) gameData.users[currentUser].puzzlePieces = [];
    const myPieces = gameData.users[currentUser].puzzlePieces;
    
    for (let i = 0; i < 9; i++) {
        const piece = document.createElement('div');
        piece.style.width = '100%';
        piece.style.height = '100%';
        piece.style.transition = 'background 0.3s';
        piece.style.boxShadow = 'inset 0 0 0 1px rgba(0,0,0,0.6)';
        
        if (myPieces.includes(i)) {
            // Pieza descubierta: transparente para mostrar el fondo del grid
            piece.style.background = 'transparent';
        } else {
            // Pieza bloqueada: fondo oscuro para tapar el grid
            piece.style.background = '#222';
            piece.style.display = 'flex';
            piece.style.alignItems = 'center';
            piece.style.justifyContent = 'center';
            piece.innerHTML = '<span style="font-size: 2rem; color: #555;">🔒</span>';
        }
        grid.appendChild(piece);
    }
};

const hidePuzzle = () => {
    switchPanel('main-menu');
};

// --- Panel de Administración ---
const showAdminPanel = () => {
    switchPanel('admin-panel');
    switchAdminTab('preguntas-conjuntos');
};

const switchAdminTab = (tabId) => {
    document.querySelectorAll('#admin-panel .tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(tabId === 'admin-leaderboard' || tabId === 'admin-usuarios' ? tabId : 'admin-' + tabId).classList.remove('hidden');

    if (tabId === 'preguntas-conjuntos') renderAdminQuestions('conjuntos');
    if (tabId === 'preguntas-logica') renderAdminQuestions('logica');
    if (tabId === 'admin-leaderboard') renderAdminScores();
    if (tabId === 'admin-usuarios') renderAdminUsers();
};

const renderAdminQuestions = (category) => {
    const list = document.getElementById(`admin-list-${category}`);
    list.innerHTML = '';
    const qs = category === 'conjuntos' ? gameData.questionsConjuntos : gameData.questionsLogica;
    
    qs.forEach((q, idx) => {
        list.innerHTML += `
            <div class="leader-item" style="padding: 10px;">
                <div style="flex-grow: 1;">
                    <strong>Q${idx + 1}:</strong> ${escapeHTML(q.q)}
                    <div style="font-size: 0.8rem; color: var(--text-secondary)">Respuestas: ${escapeHTML(q.options.join(', '))} (Correcta: idx ${q.answer})</div>
                </div>
                <button class="btn-icon" style="color: var(--error)" onclick="deleteQuestion('${category}', ${idx})">❌</button>
            </div>
        `;
    });
};

const addQuestion = (category) => {
    const qInput = document.getElementById(`new-q-${category}`).value.trim();
    const opt0 = document.getElementById(`new-q-${category}-opt0`).value.trim();
    const opt1 = document.getElementById(`new-q-${category}-opt1`).value.trim();
    const opt2 = document.getElementById(`new-q-${category}-opt2`).value.trim();
    const opt3 = document.getElementById(`new-q-${category}-opt3`).value.trim();
    const ansInput = parseInt(document.getElementById(`new-q-${category}-ans`).value);

    if (!qInput || !opt0 || !opt1 || !opt2 || !opt3 || isNaN(ansInput)) {
        showNotification('Completa todos los campos correctamente', 'error');
        return;
    }

    const options = [opt0, opt1, opt2, opt3];
    if (ansInput < 0 || ansInput >= 4) {
        showNotification('El índice de respuesta correcta es inválido (0-3)', 'error');
        return;
    }

    const arr = category === 'conjuntos' ? gameData.questionsConjuntos : gameData.questionsLogica;
    arr.push({ q: qInput, options: options, answer: ansInput });
    saveData();
    
    document.getElementById(`new-q-${category}`).value = '';
    document.getElementById(`new-q-${category}-opt0`).value = '';
    document.getElementById(`new-q-${category}-opt1`).value = '';
    document.getElementById(`new-q-${category}-opt2`).value = '';
    document.getElementById(`new-q-${category}-opt3`).value = '';
    document.getElementById(`new-q-${category}-ans`).value = '';
    
    showNotification('Pregunta añadida');
    renderAdminQuestions(category);
};

const deleteQuestion = (category, index) => {
    const arr = category === 'conjuntos' ? gameData.questionsConjuntos : gameData.questionsLogica;
    if (arr.length <= 1) {
        showNotification('Debe quedar al menos una pregunta', 'error');
        return;
    }
    arr.splice(index, 1);
    saveData();
    showNotification('Pregunta eliminada');
    renderAdminQuestions(category);
};

const renderAdminScores = () => {
    const list = document.getElementById('admin-list-scores');
    list.innerHTML = '';
    const scores = [...gameData.scores].reverse(); // Más recientes primero
    
    if (scores.length === 0) {
        list.innerHTML = '<p style="text-align: center;">No hay puntuaciones registradas.</p>';
        return;
    }

    scores.forEach((s, idx) => {
        const realIndex = gameData.scores.length - 1 - idx;
        list.innerHTML += `
            <div class="leader-item" style="padding: 10px;">
                <div style="flex-grow: 1;">
                    <strong>${escapeHTML(s.username)}</strong> - ${s.mode.toUpperCase()}
                    <div style="font-size: 0.8rem; color: var(--text-secondary)">${s.score} pts - ${new Date(s.date).toLocaleString()}</div>
                </div>
                <button class="btn-icon" style="color: var(--error)" onclick="deleteScore(${realIndex})">🗑️</button>
            </div>
        `;
    });
};

const deleteScore = (index) => {
    gameData.scores.splice(index, 1);
    saveData();
    showNotification('Puntuación eliminada');
    renderAdminScores();
};

const renderAdminUsers = () => {
    const list = document.getElementById('admin-list-users');
    list.innerHTML = '';
    
    const users = Object.keys(gameData.users);
    if (users.length === 0) {
        list.innerHTML = '<p style="text-align: center;">No hay usuarios registrados.</p>';
        return;
    }

    users.forEach(username => {
        const user = gameData.users[username];
        const isSelf = username === currentUser;
        
        list.innerHTML += `
            <div class="leader-item" style="padding: 10px;">
                <div style="flex-grow: 1;">
                    <strong>${escapeHTML(username)}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-secondary)">Rol actual: <span style="color: ${user.role === 'admin' ? 'var(--error)' : 'var(--success)'}">${user.role.toUpperCase()}</span></div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="toggleUserRole('${username}')">${user.role === 'admin' ? 'Hacer Usuario' : 'Hacer Admin'}</button>
                    ${!isSelf ? `<button class="btn-icon" style="color: var(--error)" onclick="deleteUserByAdmin('${username}')">🗑️</button>` : ''}
                </div>
            </div>
        `;
    });
};

const toggleUserRole = (username) => {
    if (gameData.users[username]) {
        const newRole = gameData.users[username].role === 'admin' ? 'user' : 'admin';
        gameData.users[username].role = newRole;
        
        if (username === currentUser && newRole === 'user') {
            showNotification('Te has quitado el rol de administrador. Saldrás del panel.', 'error');
            currentRole = 'user';
            document.getElementById('user-display').textContent = username;
            document.getElementById('btn-admin-panel').classList.add('hidden');
            switchPanel('main-menu');
        } else {
            showNotification(`Rol de ${username} cambiado a ${newRole}`);
            renderAdminUsers();
        }
        saveData();
    }
};

const deleteUserByAdmin = (username) => {
    if (username === currentUser) {
        showNotification('No puedes eliminarte a ti mismo', 'error');
        return;
    }
    if (gameData.users[username]) {
        delete gameData.users[username];
        
        // Opcional: Eliminar sus puntajes también
        gameData.scores = gameData.scores.filter(s => s.username.toLowerCase() !== username.toLowerCase());
        
        saveData();
        showNotification(`Usuario ${username} eliminado`);
        renderAdminUsers();
    }
};

// --- Cambio de Tema ---
const toggleTheme = () => {
    let isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    isDark = !isDark;
    
    if (!isDark) {
        document.documentElement.removeAttribute('data-theme');
        gameData.theme = 'light';
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        gameData.theme = 'dark';
    }
    
    // Actualizar barra de título nativa
    if (window.pywebview && window.pywebview.api && window.pywebview.api.change_titlebar_theme) {
        window.pywebview.api.change_titlebar_theme(isDark);
    }
    
    saveData();
};
