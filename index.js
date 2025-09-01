//
// CRACKIT - General Knowledge Quiz
// [FIXED] Corrected formatting and removed code compression errors.
//

// --- Tone.js Sound Synthesizers ---
const sounds = {
    correct: new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.1, release: 0.3 } }).toDestination(),
    incorrect: new Tone.NoiseSynth({ envelope: { attack: 0.01, decay: 0.1, sustain: 0 } }).toDestination(),
    roundComplete: new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" } }).toDestination(),
    badgeUnlock: new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.05, release: 0.2 } }).toDestination(),
};

/**
 * Plays a sound effect after ensuring the audio context is running.
 * @param {'correct' | 'incorrect' | 'roundComplete' | 'badgeUnlock'} soundName - The name of the sound to play.
 */
function playSound(soundName) {
    if (Tone.context.state !== 'running') {
        Tone.start().catch(e => console.error("Could not start audio context:", e));
    }
    setTimeout(() => {
        try {
            switch (soundName) {
                case 'correct': sounds.correct.triggerAttackRelease("E5", "8n"); break;
                case 'incorrect': sounds.incorrect.triggerAttackRelease("16n"); break;
                case 'roundComplete': sounds.roundComplete.triggerAttackRelease(["C4", "E4", "G4"], "0.5"); break;
                case 'badgeUnlock':
                    const now = Tone.now();
                    sounds.badgeUnlock.triggerAttackRelease("G5", "0.1", now);
                    sounds.badgeUnlock.triggerAttackRelease("C6", "0.1", now + 0.15);
                    break;
            }
        } catch (e) { console.error(`Error playing sound ${soundName}:`, e); }
    }, 50);
}

// --- Main Application Logic ---
document.addEventListener('DOMContentLoaded', () => {

    // --- Constants ---
    const constants = {
        QUESTIONS_PER_ROUND: 10,
        PASS_THRESHOLD: 8,
        CIRCLE_CIRCUMFERENCE: 2 * Math.PI * 45,
        STORAGE_KEYS: {
            SCORE: 'crackitTotalScore_v2',
            ROUND: 'crackitCurrentRound_v2',
            LAST_CORRECT: 'crackitLastRoundCorrectAnswers_v2',
            STATS: 'crackitUserStats_v2',
            BADGES: 'crackitBadges_v2',
        }
    };

    // --- DOM Element References ---
    const dom = {
        screens: { loading: document.getElementById('loading-screen'), quiz: document.getElementById('quiz-screen'), summary: document.getElementById('round-summary-screen') },
        quiz: { currentRound: document.getElementById('current-round'), totalScore: document.getElementById('total-score'), questionText: document.getElementById('question-text'), optionsContainer: document.getElementById('options-container'), feedbackArea: document.getElementById('feedback-area'), explanationText: document.getElementById('explanation-text'), nextQuestionButton: document.getElementById('next-question-button'), progressBar: document.getElementById('progressBar'), questionCounter: document.getElementById('question-counter') },
        summary: { roundNumber: document.getElementById('summary-round-number'), correctCount: document.getElementById('summary-correct-count'), totalQuestions: document.getElementById('summary-total-questions'), progressBar: document.getElementById('summaryProgressBar'), totalScore: document.getElementById('summary-total-score'), performanceFeedback: document.getElementById('performance-feedback'), nextRoundButton: document.getElementById('next-round-button'), tryAgainButton: document.getElementById('try-again-button'), restartButton: document.getElementById('restart-quiz-summary-button') },
        collapsibles: { reviewButton: document.getElementById('toggle-review-button'), reviewContainer: document.getElementById('review-list-container'), achievementsButton: document.getElementById('toggle-achievements-button'), achievementsContainer: document.getElementById('achievements-list-container') },
        drawer: { sidebar: document.getElementById('sidebar-drawer'), openButton: document.getElementById('open-drawer-button'), closeButton: document.getElementById('close-drawer-button'), overlay: document.getElementById('drawer-overlay'), badgesEarnedList: document.getElementById('badges-earned-list'), badgesToEarnList: document.getElementById('badges-to-earn-list'), noEarnedMsg: document.getElementById('no-earned-badges'), noToEarnMsg: document.getElementById('no-badges-to-earn') },
        offlineMessage: document.getElementById('offline-message'),
        toastContainer: document.getElementById('toast-container'),
    };

    // --- Quiz State Management ---
    let state = {};

    // --- Badge & Message Definitions ---
    const allBadges = {
        'HistoryBronze': { name: 'Time Traveller', desc: 'Achieve 5 correct answers in History.', icon: 'fas fa-hourglass-half', category: 'Subject', target: 5, statKey: 'History' },
        'HistorySilver': { name: 'Archivist', desc: 'Achieve 20 correct answers in History.', icon: 'fas fa-book', category: 'Subject', target: 20, statKey: 'History' },
        'HistoryGold': { name: 'Historian Supreme', desc: 'Achieve 50 correct answers in History.', icon: 'fas fa-scroll', category: 'Subject', target: 50, statKey: 'History' },
        'GeographyBronze': { name: 'Map Reader', desc: 'Achieve 5 correct answers in Geography.', icon: 'fas fa-map', category: 'Subject', target: 5, statKey: 'Geography' },
        'GeographySilver': { name: 'Globe Trotter', desc: 'Achieve 20 correct answers in Geography.', icon: 'fas fa-globe-americas', category: 'Subject', target: 20, statKey: 'Geography' },
        'GeographyGold': { name: 'World Navigator', desc: 'Achieve 50 correct answers in Geography.', icon: 'fas fa-compass', category: 'Subject', target: 50, statKey: 'Geography' },
        'PolityBronze': { name: 'Civic Learner', desc: 'Achieve 5 correct answers in Polity.', icon: 'fas fa-gavel', category: 'Subject', target: 5, statKey: 'Polity' },
        'PolitySilver': { name: 'Policy Pundit', desc: 'Achieve 20 correct answers in Polity.', icon: 'fas fa-balance-scale', category: 'Subject', target: 20, statKey: 'Polity' },
        'PolityGold': { name: 'Constitution Champion', desc: 'Achieve 50 correct answers in Polity.', icon: 'fas fa-flag-usa', category: 'Subject', target: 50, statKey: 'Polity' },
        'EconomyBronze': { name: 'Penny Wise', desc: 'Achieve 5 correct answers in Economy.', icon: 'fas fa-coins', category: 'Subject', target: 5, statKey: 'Economy' },
        'EconomySilver': { name: 'Market Analyst', desc: 'Achieve 20 correct answers in Economy.', icon: 'fas fa-chart-line', category: 'Subject', target: 20, statKey: 'Economy' },
        'EconomyGold': { name: 'Economic Visionary', desc: 'Achieve 50 correct answers in Economy.', icon: 'fas fa-piggy-bank', category: 'Subject', target: 50, statKey: 'Economy' },
        'ScienceTechBronze': { name: 'Lab Assistant', desc: 'Achieve 5 correct answers in Science & Tech.', icon: 'fas fa-flask', category: 'Subject', target: 5, statKey: 'Science & Tech' },
        'ScienceTechSilver': { name: 'Innovator', desc: 'Achieve 20 correct answers in Science & Tech.', icon: 'fas fa-lightbulb', category: 'Subject', target: 20, statKey: 'Science & Tech' },
        'ScienceTechGold': { name: 'Tech Guru', desc: 'Achieve 50 correct answers in Science & Tech.', icon: 'fas fa-robot', category: 'Subject', target: 50, statKey: 'Science & Tech' },
        'MathematicsBronze': { name: 'Number Cruncher', desc: 'Achieve 5 correct answers in Mathematics.', icon: 'fas fa-calculator', category: 'Subject', target: 5, statKey: 'Mathematics' },
        'MathematicsSilver': { name: 'Problem Solver', desc: 'Achieve 20 correct answers in Mathematics.', icon: 'fas fa-square-root-alt', category: 'Subject', target: 20, statKey: 'Mathematics' },
        'MathematicsGold': { name: 'Math Wizard', desc: 'Achieve 50 correct answers in Mathematics.', icon: 'fas fa-infinity', category: 'Subject', target: 50, statKey: 'Mathematics' },
        'ReasoningBronze': { name: 'Puzzle Player', desc: 'Achieve 5 correct answers in Reasoning.', icon: 'fas fa-puzzle-piece', category: 'Subject', target: 5, statKey: 'Reasoning' },
        'ReasoningSilver': { name: 'Logic Builder', desc: 'Achieve 20 correct answers in Reasoning.', icon: 'fas fa-brain', category: 'Subject', target: 20, statKey: 'Reasoning' },
        'ReasoningGold': { name: 'Mind Master', desc: 'Achieve 50 correct answers in Reasoning.', icon: 'fas fa-chess-knight', category: 'Subject', target: 50, statKey: 'Reasoning' },
        'EnglishBronze': { name: 'Word Explorer', desc: 'Achieve 5 correct answers in English.', icon: 'fas fa-book-open', category: 'Subject', target: 5, statKey: 'English' },
        'EnglishSilver': { name: 'Grammar Knight', desc: 'Achieve 20 correct answers in English.', icon: 'fas fa-pen-nib', category: 'Subject', target: 20, statKey: 'English' },
        'EnglishGold': { name: 'Language Maestro', desc: 'Achieve 50 correct answers in English.', icon: 'fas fa-language', category: 'Subject', target: 50, statKey: 'English' },
        'MiscellaneousBronze': { name: 'Generalist', desc: 'Achieve 5 correct answers in Miscellaneous.', icon: 'fas fa-dice-d6', category: 'Subject', target: 5, statKey: 'Miscellaneous' },
        'OneDayWonder': { name: 'One-Day Wonder', desc: 'Complete first quiz day.', icon: 'fas fa-sun', category: 'Streak', target: 1, statKey: 'currentStreak' },
        'WeeklyWarrior': { name: 'Weekly Warrior', desc: 'Complete a 7-day streak.', icon: 'fas fa-calendar-week', category: 'Streak', target: 7, statKey: 'currentStreak' },
        'FortnightFighter': { name: 'Fortnight Fighter', desc: 'Complete a 14-day streak.', icon: 'fas fa-calendar-alt', category: 'Streak', target: 14, statKey: 'currentStreak' },
        'MonthlyMarathoner': { name: 'Monthly Marathoner', desc: 'Complete a 30-day streak.', icon: 'fas fa-calendar-check', category: 'Streak', target: 30, statKey: 'currentStreak' },
        'EvergreenLearner': { name: 'Evergreen Learner', desc: 'Complete a 100-day streak.', icon: 'fas fa-seedling', category: 'Streak', target: 100, statKey: 'currentStreak' },
        'SharpShooter': { name: 'Sharp Shooter', desc: 'Achieve 90%+ accuracy in one quiz.', icon: 'fas fa-bullseye', category: 'Performance' },
        'FlawlessVictory': { name: 'Flawless Victory', desc: 'Achieve a perfect score.', icon: 'fas fa-star', category: 'Performance' },
        'FirstStep': { name: 'First Step', desc: 'Complete 1 quiz.', icon: 'fas fa-shoe-prints', category: 'Progression', target: 1, statKey: 'quizzesCompleted' },
        'Trailblazer': { name: 'Trailblazer', desc: 'Complete 10 quizzes.', icon: 'fas fa-fire', category: 'Progression', target: 10, statKey: 'quizzesCompleted' },
        'QuizEnthusiast': { name: 'Quiz Enthusiast', desc: 'Complete 50 quizzes.', icon: 'fas fa-feather-alt', category: 'Progression', target: 50, statKey: 'quizzesCompleted' },
        'KnowledgeHunter': { name: 'Knowledge Hunter', desc: 'Complete 100 quizzes.', icon: 'fas fa-book-reader', category: 'Progression', target: 100, statKey: 'quizzesCompleted' },
        'QuizLegend': { name: 'Quiz Legend', desc: 'Complete 500 quizzes.', icon: 'fas fa-dragon', category: 'Progression', target: 500, statKey: 'quizzesCompleted' },
    };
    const motivationalMessages = [ "Keep pushing forward, every question makes you smarter!", "Great to see you back! Time to conquer some more knowledge.", "Your dedication is inspiring! Let's learn something new today.", "Consistency is key! A little progress each day adds up to big results." ];
    
    // --- Local Storage Utilities ---
    const storage = {
        get: (key) => { try { return localStorage.getItem(key); } catch (e) { console.error(e); return null; } },
        set: (key, value) => { try { localStorage.setItem(key, value); } catch (e) { console.error(e); } },
        remove: (key) => { try { localStorage.removeItem(key); } catch (e) { console.error(e); } }
    };

    // --- Core Functions ---
    function resetState() {
        state = {
            currentQuestions: [],
            currentQuestionIndex: 0,
            totalScore: 0,
            currentRound: 1,
            correctAnswersInRound: 0,
            lastRoundCorrectAnswers: 0,
            answeredQuestionsLog: [],
            earnedBadges: [],
            userStats: {
                quizzesCompleted: 0,
                currentStreak: 0,
                lastPlayedDate: null,
                highestStreak: 0,
                subjectsStats: {},
                lastMotivationalMessageDate: null
            }
        };
    }

    function loadState() {
        resetState();
        state.totalScore = parseInt(storage.get(constants.STORAGE_KEYS.SCORE) || '0', 10);
        state.currentRound = parseInt(storage.get(constants.STORAGE_KEYS.ROUND) || '1', 10);
        state.lastRoundCorrectAnswers = parseInt(storage.get(constants.STORAGE_KEYS.LAST_CORRECT) || '0', 10);
        state.earnedBadges = JSON.parse(storage.get(constants.STORAGE_KEYS.BADGES) || '[]');
        const savedStats = storage.get(constants.STORAGE_KEYS.STATS);
        if (savedStats) {
            state.userStats = { ...state.userStats, ...JSON.parse(savedStats) };
        }
    }

    function updateUIFromState() {
        dom.quiz.totalScore.textContent = state.totalScore;
        dom.quiz.currentRound.textContent = state.currentRound;
    }

    function addEventListeners() {
        dom.quiz.nextQuestionButton.addEventListener('click', nextQuestion);
        dom.summary.nextRoundButton.addEventListener('click', startNewRound);
        dom.summary.tryAgainButton.addEventListener('click', startNewRound);
        dom.summary.restartButton.addEventListener('click', resetQuiz);
        dom.collapsibles.reviewButton.addEventListener('click', () => toggleCollapsible('review'));
        dom.collapsibles.achievementsButton.addEventListener('click', () => toggleCollapsible('achievements'));
        dom.drawer.openButton.addEventListener('click', toggleDrawer);
        dom.drawer.closeButton.addEventListener('click', toggleDrawer);
        dom.drawer.overlay.addEventListener('click', toggleDrawer);
        window.addEventListener('online', checkOnlineStatus);
        window.addEventListener('offline', checkOnlineStatus);
        document.body.addEventListener('click', () => { if (Tone.context.state !== 'running') { Tone.start(); } }, { once: true });
    }

    function startQuizFlow() {
        animateScreenTransition(dom.screens.loading, dom.screens.quiz);
        state.currentQuestionIndex = 0;
        state.correctAnswersInRound = 0;
        state.answeredQuestionsLog = [];
        prepareQuestionsForNextRound(state.lastRoundCorrectAnswers);
        dom.quiz.currentRound.textContent = state.currentRound;
        loadQuestion();
        showDailyMotivationalMessage();
    }

    function prepareQuestionsForNextRound(previousCorrectAnswers) {
        if (typeof quizData === 'undefined' || !quizData.length) {
            dom.quiz.questionText.textContent = "Error: Could not load questions.";
            console.error("quizData is not defined!");
            return;
        }
        const shuffle = (arr) => arr.sort(() => 0.5 - Math.random());
        let easy = shuffle(quizData.filter(q => q.difficulty === 'easy'));
        let moderate = shuffle(quizData.filter(q => q.difficulty === 'moderate'));
        let hard = shuffle(quizData.filter(q => q.difficulty === 'hard'));
        
        if (previousCorrectAnswers < 4) {
            state.currentQuestions = easy.slice(0, constants.QUESTIONS_PER_ROUND);
        } else if (previousCorrectAnswers <= 7) {
            state.currentQuestions = easy.slice(0, 5).concat(moderate.slice(0, 5));
        } else {
            state.currentQuestions = moderate.slice(0, 5).concat(hard.slice(0, 5));
        }
        
        while (state.currentQuestions.length < constants.QUESTIONS_PER_ROUND) {
            state.currentQuestions.push(quizData[Math.floor(Math.random() * quizData.length)]);
        }
        state.currentQuestions = shuffle(state.currentQuestions.slice(0, constants.QUESTIONS_PER_ROUND));
    }

    function loadQuestion() {
        const question = state.currentQuestions[state.currentQuestionIndex];
        if (!question) {
            endRound();
            return;
        }
        dom.quiz.questionText.textContent = question.question;
        dom.quiz.optionsContainer.innerHTML = '';
        
        [...question.options].sort(() => 0.5 - Math.random()).forEach(option => {
            const button = document.createElement('button');
            button.textContent = option;
            button.className = 'option-button';
            button.dataset.option = option;
            button.addEventListener('click', (e) => selectAnswer(option, e.currentTarget));
            dom.quiz.optionsContainer.appendChild(button);
        });

        dom.quiz.feedbackArea.classList.add('hidden');
        dom.quiz.explanationText.innerHTML = '';
        dom.quiz.nextQuestionButton.classList.add('hidden');
        dom.quiz.questionCounter.textContent = `${state.currentQuestionIndex + 1}/${constants.QUESTIONS_PER_ROUND}`;
        updateProgressBar(dom.quiz.progressBar, state.currentQuestionIndex, constants.QUESTIONS_PER_ROUND);
    }

    function selectAnswer(selectedOption, clickedButton) {
        const question = state.currentQuestions[state.currentQuestionIndex];
        const isCorrect = selectedOption === question.answer;

        document.querySelectorAll('.option-button').forEach(button => {
            button.disabled = true;
            if (button.dataset.option === question.answer) {
                button.classList.add('correct');
            } else if (button === clickedButton) {
                button.classList.add('incorrect');
            } else {
                button.classList.add('opacity-50');
            }
        });

        if (isCorrect) {
            state.correctAnswersInRound++;
            state.totalScore += 10;
            dom.quiz.explanationText.innerHTML = `<i class="fas fa-check-circle text-green-500"></i> <strong>Correct!</strong> ${question.explanation}`;
            playSound('correct');
        } else {
            dom.quiz.explanationText.innerHTML = `<i class="fas fa-times-circle text-red-500"></i> <strong>Incorrect.</strong> ${question.explanation}`;
            playSound('incorrect');
        }

        state.answeredQuestionsLog.push({ question: question.question, userAnswer: selectedOption, correctAnswer: question.answer, isCorrect, explanation: question.explanation, subject: question.subject });
        
        const subject = question.subject || 'Miscellaneous';
        if (!state.userStats.subjectsStats[subject]) {
            state.userStats.subjectsStats[subject] = { correct: 0, attempted: 0 };
        }
        state.userStats.subjectsStats[subject].attempted++;
        if (isCorrect) {
            state.userStats.subjectsStats[subject].correct++;
        }
        
        storage.set(constants.STORAGE_KEYS.SCORE, state.totalScore);
        storage.set(constants.STORAGE_KEYS.STATS, JSON.stringify(state.userStats));
        
        dom.quiz.feedbackArea.classList.remove('hidden');
        dom.quiz.nextQuestionButton.classList.remove('hidden');
        dom.quiz.totalScore.textContent = state.totalScore;
    }

    function nextQuestion() {
        state.currentQuestionIndex++;
        if (state.currentQuestionIndex < constants.QUESTIONS_PER_ROUND) {
            loadQuestion();
        } else {
            endRound();
        }
    }

    function endRound() {
        animateScreenTransition(dom.screens.quiz, dom.screens.summary);
        const percentage = (state.correctAnswersInRound / constants.QUESTIONS_PER_ROUND) * 100;
        dom.summary.roundNumber.textContent = state.currentRound;
        dom.summary.correctCount.textContent = state.correctAnswersInRound;
        dom.summary.totalQuestions.textContent = constants.QUESTIONS_PER_ROUND;
        dom.summary.totalScore.textContent = state.totalScore;
        dom.summary.performanceFeedback.textContent = generateFeedback(percentage);
        updateProgressBar(dom.summary.progressBar, state.correctAnswersInRound, constants.QUESTIONS_PER_ROUND);
        
        state.userStats.quizzesCompleted++;
        updateStreak();
        state.lastRoundCorrectAnswers = state.correctAnswersInRound;
        storage.set(constants.STORAGE_KEYS.LAST_CORRECT, state.lastRoundCorrectAnswers);
        checkAchievements();
        playSound('roundComplete');
        
        if (state.correctAnswersInRound >= constants.PASS_THRESHOLD) {
            dom.summary.nextRoundButton.classList.remove('hidden');
            dom.summary.tryAgainButton.classList.add('hidden');
            dom.summary.nextRoundButton.innerHTML = `Proceed to Round ${state.currentRound + 1} <i class="fas fa-forward"></i>`;
            state.currentRound++;
            storage.set(constants.STORAGE_KEYS.ROUND, state.currentRound);
        } else {
            dom.summary.nextRoundButton.classList.add('hidden');
            dom.summary.tryAgainButton.classList.remove('hidden');
        }
        
        dom.collapsibles.reviewContainer.style.display = 'none';
        dom.collapsibles.reviewButton.setAttribute('aria-expanded', 'false');
        dom.collapsibles.achievementsContainer.style.display = 'none';
        dom.collapsibles.achievementsButton.setAttribute('aria-expanded', 'false');
    }

    function startNewRound() {
        animateScreenTransition(dom.screens.summary, dom.screens.quiz);
        state.currentQuestionIndex = 0;
        state.correctAnswersInRound = 0;
        state.answeredQuestionsLog = [];
        prepareQuestionsForNextRound(state.lastRoundCorrectAnswers);
        dom.quiz.currentRound.textContent = state.currentRound;
        loadQuestion();
    }

    function resetQuiz() {
        Object.values(constants.STORAGE_KEYS).forEach(key => storage.remove(key));
        loadState();
        updateUIFromState();
        animateScreenTransition(dom.screens.summary, dom.screens.loading);
        setTimeout(startQuizFlow, 1500);
    }

    // --- UI & Utility Functions ---
    function toggleCollapsible(sectionName) {
        const button = dom.collapsibles[`${sectionName}Button`];
        const container = dom.collapsibles[`${sectionName}Container`];
        const isHidden = container.style.display === 'none' || !container.style.display;
        if (isHidden) {
            if (sectionName === 'achievements') populateAchievementsList();
            if (sectionName === 'review') populateReviewList();
            container.style.display = 'grid';
            button.setAttribute('aria-expanded', 'true');
        } else {
            container.style.display = 'none';
            button.setAttribute('aria-expanded', 'false');
        }
    }

    function updateProgressBar(element, current, total) {
        const progress = total > 0 ? current / total : 0;
        element.style.strokeDashoffset = constants.CIRCLE_CIRCUMFERENCE * (1 - progress);
    }

    function generateFeedback(percentage) {
        if (percentage === 100) return "Perfect Score! You're a quiz master!";
        if (percentage >= 90) return "Excellent work! Truly impressive!";
        if (percentage >= constants.PASS_THRESHOLD * 10) return "Great job! You've passed the round!";
        return "Keep practicing! Every attempt is a step forward.";
    }

    function showToast({ icon, title, message }) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="toast__icon ${icon}"></i><div><p class="toast__title">${title}</p><p class="toast__message">${message}</p></div>`;
        dom.toastContainer.prepend(toast);
        setTimeout(() => {
            toast.classList.add('toast-exit');
            toast.addEventListener('animationend', () => toast.remove());
        }, 4000);
    }

    function checkOnlineStatus() {
        dom.offlineMessage.style.display = navigator.onLine ? 'none' : 'flex';
    }

    function toggleDrawer() {
        const isOpen = dom.drawer.sidebar.classList.toggle('open');
        dom.drawer.overlay.classList.toggle('open');
        document.body.style.overflow = isOpen ? 'hidden' : '';
        if (isOpen) populateDrawerBadges();
    }

    function populateReviewList() {
        dom.collapsibles.reviewContainer.innerHTML = state.answeredQuestionsLog.map((item, index) =>
            `<div class="p-4 bg-white rounded-lg shadow-sm border">
                <p class="font-bold mb-2">Q${index + 1}: ${item.question}</p>
                <p class="mb-1"><i class="fas ${item.isCorrect ? 'fa-check-circle text-green-500' : 'fa-times-circle text-red-500'} mr-2"></i>Your Answer: <span class="font-semibold ${item.isCorrect ? 'text-green-700' : 'text-red-700'}">${item.userAnswer}</span></p>
                ${!item.isCorrect ? `<p class="mb-2"><i class="fas fa-lightbulb text-indigo-500 mr-2"></i>Correct Answer: <span class="font-semibold text-indigo-700">${item.correctAnswer}</span></p>` : ''}
                <p class="text-sm border-t pt-2 mt-2">${item.explanation}</p>
            </div>`
        ).join('');
    }

    function awardBadge(badgeId) {
        if (!state.earnedBadges.includes(badgeId) && allBadges[badgeId]) {
            state.earnedBadges.push(badgeId);
            storage.set(constants.STORAGE_KEYS.BADGES, JSON.stringify(state.earnedBadges));
            showToast({ icon: allBadges[badgeId].icon, title: 'Badge Unlocked!', message: allBadges[badgeId].name });
            playSound('badgeUnlock');
        }
    }

    function checkAchievements() {
        const accuracy = (state.correctAnswersInRound / constants.QUESTIONS_PER_ROUND) * 100;
        if (accuracy >= 90) awardBadge('SharpShooter');
        if (accuracy === 100) awardBadge('FlawlessVictory');

        Object.keys(allBadges).forEach(badgeId => {
            const badge = allBadges[badgeId];
            if (badge.category === 'Progression' && state.userStats[badge.statKey] >= badge.target) awardBadge(badgeId);
            if (badge.category === 'Streak' && state.userStats[badge.statKey] >= badge.target) awardBadge(badgeId);
            if (badge.category === 'Subject' && state.userStats.subjectsStats[badge.statKey] && state.userStats.subjectsStats[badge.statKey].correct >= badge.target) awardBadge(badgeId);
        });
    }

    function animateScreenTransition(hideScreen, showScreen) {
        hideScreen.classList.add('hidden');
        showScreen.classList.remove('hidden');
    }

    function populateDrawerBadges() {
        dom.drawer.badgesEarnedList.innerHTML = '';
        dom.drawer.badgesToEarnList.innerHTML = '';
    
        if (state.earnedBadges.length > 0) {
            dom.drawer.noEarnedMsg.style.display = 'none';
            state.earnedBadges.forEach(badgeId => {
                const badge = allBadges[badgeId];
                if (badge) {
                    const el = document.createElement('div');
                    el.innerHTML = `<i class="${badge.icon} text-xl text-indigo-600 mb-1"></i><p class="font-semibold text-xs text-center">${badge.name}</p>`;
                    dom.drawer.badgesEarnedList.appendChild(el);
                }
            });
        } else {
            dom.drawer.noEarnedMsg.style.display = 'block';
        }
    
        const unearnedBadges = Object.keys(allBadges).filter(id => !state.earnedBadges.includes(id));
        if (unearnedBadges.length > 0) {
            dom.drawer.noToEarnMsg.style.display = 'none';
            unearnedBadges.forEach(badgeId => {
                const badge = allBadges[badgeId];
                let progressHTML = '';
                if (badge.target) {
                    let current = 0;
                    if (badge.category === 'Progression' || badge.category === 'Streak') {
                        current = state.userStats[badge.statKey] || 0;
                    } else if (badge.category === 'Subject' && state.userStats.subjectsStats[badge.statKey]) {
                        current = state.userStats.subjectsStats[badge.statKey].correct || 0;
                    }
                    const percentage = Math.min(100, (current / badge.target) * 100);
                    progressHTML = `<div class="w-full bg-gray-200 rounded-full h-2 mt-2"><div class="bg-indigo-400 h-2 rounded-full" style="width: ${percentage}%"></div></div>`;
                }
                const el = document.createElement('div');
                el.className = 'p-3 bg-white rounded-lg shadow-sm border';
                el.innerHTML = `<div class="flex items-center mb-2"><i class="${badge.icon} text-2xl text-yellow-500 mr-3"></i><div><p class="font-semibold text-gray-900">${badge.name}</p><p class="text-xs text-gray-500">${badge.desc}</p></div></div>${progressHTML}`;
                dom.drawer.badgesToEarnList.appendChild(el);
            });
        } else {
            dom.drawer.noToEarnMsg.style.display = 'block';
        }
    }
    
    function populateAchievementsList() {
        dom.collapsibles.achievementsContainer.innerHTML = '';
        if (state.earnedBadges.length === 0) {
            dom.collapsibles.achievementsContainer.innerHTML = '<p class="text-center text-gray-600 col-span-full py-4">No achievements yet. Keep playing!</p>';
            return;
        }
        state.earnedBadges.forEach(badgeId => {
            const badge = allBadges[badgeId];
            if (badge) {
                const el = document.createElement('div');
                el.className = 'flex flex-col items-center justify-center p-3 bg-white rounded-lg shadow-md border';
                el.innerHTML = `<i class="${badge.icon} text-3xl text-yellow-500 mb-2"></i><p class="font-semibold text-gray-800 text-sm text-center">${badge.name}</p><p class="text-xs text-gray-500 text-center">${badge.desc}</p>`;
                dom.collapsibles.achievementsContainer.appendChild(el);
            }
        });
    }

    function updateStreak() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastPlayed = state.userStats.lastPlayedDate ? new Date(state.userStats.lastPlayedDate) : null;
        let streakUpdated = false;

        if (lastPlayed) {
            const diffDays = Math.round((today.getTime() - lastPlayed.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                state.userStats.currentStreak++;
                streakUpdated = true;
            } else if (diffDays > 1) {
                state.userStats.currentStreak = 1;
                streakUpdated = true;
            }
        } else {
            state.userStats.currentStreak = 1;
            streakUpdated = true;
        }

        if (streakUpdated) {
            state.userStats.lastPlayedDate = today.toISOString();
            if (state.userStats.currentStreak > state.userStats.highestStreak) {
                state.userStats.highestStreak = state.userStats.currentStreak;
            }
        }
    }

    function showDailyMotivationalMessage() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastMessageDate = state.userStats.lastMotivationalMessageDate ? new Date(state.userStats.lastMotivationalMessageDate) : null;
        if (!lastMessageDate || lastMessageDate.getTime() !== today.getTime()) {
            const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
            showToast({ icon: 'fas fa-lightbulb', title: 'Daily Motivation!', message: randomMessage });
            state.userStats.lastMotivationalMessageDate = today.toISOString();
            storage.set(constants.STORAGE_KEYS.STATS, JSON.stringify(state.userStats));
        }
    }

    // --- App Entry Point ---
    function initialize() {
        loadState();
        updateUIFromState();
        addEventListeners();
        checkOnlineStatus();
        dom.screens.loading.classList.remove('hidden');
        setTimeout(startQuizFlow, 1500);
    }
    
    initialize();
});